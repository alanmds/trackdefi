/**
 * Reserva de RPCs que DIVIDE a carga entre vários provedores gratuitos.
 *
 * Por quê (17/11/2026): o site dependia de UMA conta grátis da Alchemy (30 M CUs/mês,
 * 500 CU/s) e ela chegou ao limite. O `fallback` do viem só passa para o próximo RPC
 * quando o primeiro FALHA — ou seja, um segundo provedor ficaria parado até o
 * primeiro morrer. Aqui os provedores trabalham juntos:
 *
 *  - **dedicados** (qualquer URL na env que não seja Alchemy — dRPC, Ankr, Infura,
 *    BlockPI, QuickNode…): revezam entre si, pedido a pedido;
 *  - **Alchemy**: vira a reserva da leitura comum, para guardar a cota dela para o que
 *    SÓ ela faz (índices do v4 e do v2, ver `core/alchemy-budget.ts`). Sem nenhum outro
 *    dedicado, ela segue como primeira, como sempre foi;
 *  - **públicos** (`defaultRpcs` da rede): última linha.
 *
 * Provedor que falha por limite/queda sai da fila por um tempo (2 s, dobrando até 2 min,
 * e volta no primeiro sucesso). Erro que é resposta do CONTRATO (revert) volta direto
 * para quem chamou: trocar de RPC não muda a resposta e não pode punir o provedor.
 * Acrescentar um provedor = acrescentar a URL na `<REDE>_RPC_URLS`, separada por vírgula.
 */

import { custom, http, type Chain, type Transport } from "viem";
import { alchemyBudgetLeft, chargeAlchemy } from "./alchemy-budget";

export type Tier = "dedicated" | "alchemy" | "public";

export interface PlannedRpc {
  url: string;
  tier: Tier;
}

export const isAlchemyUrl = (u: string): boolean => /\.alchemy\.com\//.test(u);

/** monta a lista (com a camada de cada URL) a partir da env e dos públicos da rede */
export function planRpcs(envList: string[], publicList: string[]): PlannedRpc[] {
  const seen = new Set<string>();
  const out: PlannedRpc[] = [];
  for (const url of envList) {
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, tier: isAlchemyUrl(url) ? "alchemy" : "dedicated" });
  }
  for (const url of publicList) {
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, tier: "public" });
  }
  return out;
}

interface Slot extends PlannedRpc {
  coolUntil: number;
  fails: number;
  send: (req: { method: string; params?: unknown }) => Promise<unknown>;
}

const COOL_MIN_MS = 2_000;
const COOL_MAX_MS = 120_000;

/** erro que é a RESPOSTA do contrato (revert) — não é culpa do provedor */
export function isContractError(e: unknown): boolean {
  const x = e as { code?: number; message?: string; details?: string; cause?: unknown };
  if (x?.code === 3) return true;
  const text = `${x?.message ?? ""} ${x?.details ?? ""}`;
  return /execution reverted|revert(ed)?\b/i.test(text);
}

/** o provedor está sobrecarregado ou fora do ar (vale esperar antes de insistir)? */
export function isOutage(e: unknown): boolean {
  const x = e as { status?: number; code?: number; name?: string; message?: string; cause?: unknown };
  if (typeof x?.status === "number") return x.status === 429 || x.status >= 500 || x.status === 403 || x.status === 401;
  if (x?.code === -32005 || x?.code === 429) return true; // limite de uso (EIP-1474)
  if (/timeout|timed out|fetch failed|network|ECONN|ENOTFOUND|rate limit|too many|capacity|exceeded/i.test(`${x?.name} ${x?.message}`)) return true;
  return x?.cause ? isOutage(x.cause) : false;
}

export interface PoolOptions {
  timeoutMs?: number;
  now?: () => number;
  /** teste: troca o envio HTTP real */
  makeSend?: (url: string) => Slot["send"];
}

/** o transporte do viem que reparte os pedidos pela lista */
export function poolTransport(chain: Chain, plan: PlannedRpc[], opts: PoolOptions = {}): Transport {
  const now = opts.now ?? Date.now;
  const slots: Slot[] = plan.map((p) => ({
    ...p,
    coolUntil: 0,
    fails: 0,
    send:
      opts.makeSend?.(p.url) ??
      ((req) => http(p.url, { timeout: opts.timeoutMs ?? 30_000, retryCount: 0 })({ chain, retryCount: 0 }).request(req as never)),
  }));
  let turn = 0;

  /** ordem de tentativa para ESTE pedido */
  function order(): Slot[] {
    const t = now();
    const ready = (s: Slot) => t >= s.coolUntil;
    const rotate = <T,>(list: T[]): T[] => {
      if (list.length < 2) return list;
      const k = turn % list.length;
      return [...list.slice(k), ...list.slice(0, k)];
    };
    const ded = rotate(slots.filter((s) => s.tier === "dedicated" && ready(s)));
    const alc = alchemyBudgetLeft(t) ? slots.filter((s) => s.tier === "alchemy" && ready(s)) : [];
    const pub = rotate(slots.filter((s) => s.tier === "public" && ready(s)));
    const live = [...ded, ...alc, ...pub];
    // todos esfriando (ou orçamento acabou e não há outro): melhor tentar do que falhar de cara
    const rest = slots.filter((s) => !live.includes(s));
    return [...live, ...rest];
  }

  return custom(
    {
      async request(req: { method: string; params?: unknown }) {
        const list = order();
        turn++;
        let last: unknown;
        for (const s of list) {
          try {
            if (s.tier === "alchemy") chargeAlchemy(req.method, now());
            const r = await s.send(req);
            s.fails = 0;
            s.coolUntil = 0;
            return r;
          } catch (e) {
            if (isContractError(e)) throw e;
            last = e;
            if (isOutage(e)) {
              s.fails++;
              s.coolUntil = now() + Math.min(COOL_MAX_MS, COOL_MIN_MS * 2 ** (s.fails - 1));
            }
            // erro de método/estado (ex.: sem histórico neste provedor): só tenta o próximo
          }
        }
        throw last instanceof Error ? last : new Error("nenhum RPC respondeu");
      },
    },
    { retryCount: 0 },
  );
}
