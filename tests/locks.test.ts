/**
 * Locks de governança veAERO/veVELO (25/09/2026).
 *
 * Números da carteira demo lidos no `poc/probe-venft.ts`: o veNFT #2 na
 * Optimism tem 145.850,26 VELO travados, vencidos em 27/08/2026, com rebase e
 * recompensas de voto a receber — e bateu com o Zerion a 1,4%.
 */

import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { buildLocks, lockHasSubstance, type RawLock, type RawVoteReward } from "../core/adapters/aerodrome/ve";
import { buildLockDTOs, buildResponse, priceKey } from "../core/service";
import type { TokenInfo } from "../core/types";
import { fmtUnixDate } from "../app/ui/format";

const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db" as Address;
const OP = "0x4200000000000000000000000000000000000042" as Address;
const TAROT = "0x1F514A61bcde34F94Bc39731235690ab9da737F7" as Address;
const E18 = 10n ** 18n;

const tokens = new Map<string, TokenInfo>([
  [VELO.toLowerCase(), { address: VELO, symbol: "VELO", decimals: 18 }],
  [OP.toLowerCase(), { address: OP, symbol: "OP", decimals: 18 }],
  [TAROT.toLowerCase(), { address: TAROT, symbol: "TAROT", decimals: 18 }],
]);

function lock(over: Partial<RawLock> = {}): RawLock {
  return {
    id: 2n,
    amount: 145_850n * E18,
    voting_amount: 0n,
    rebase_amount: 1_477n * E18,
    expires_at: 1_787_875_200n, // 2026-08-28 00:00 UTC
    votes: [{ lp: "0x0000000000000000000000000000000000000aaa" as Address, weight: 1n }],
    token: VELO,
    permanent: false,
    managed_id: 0n,
    ...over,
  };
}

const vr = (token: Address, amount: bigint): RawVoteReward => ({ venft_id: 2n, amount, token });

describe("buildLocks (leitura crua → modelo)", () => {
  it("monta o lock com rebase e recompensas de voto separadas por tipo", () => {
    const rewards = new Map([[2n, [vr(VELO, 553n * E18), vr(OP, 4n * E18), vr(TAROT, 13n * E18)]]]);
    const [l] = buildLocks([lock()], rewards, tokens, "velodrome", 10);
    expect(l.lockId).toBe("2");
    expect(l.token.symbol).toBe("VELO");
    expect(l.amountRaw).toBe(145_850n * E18);
    expect(l.rewards.filter((r) => r.kind === "rebase")).toHaveLength(1);
    expect(l.rewards.filter((r) => r.kind === "vote").map((r) => r.token.symbol).sort()).toEqual(["OP", "TAROT", "VELO"]);
  });

  it("SOMA o mesmo token vindo de pools diferentes (ou taxa + incentivo) — o resgate é por token", () => {
    const rewards = new Map([[2n, [vr(OP, 3n * E18), vr(OP, 1n * E18)]]]);
    const [l] = buildLocks([lock({ rebase_amount: 0n })], rewards, tokens, "velodrome", 10);
    expect(l.rewards).toHaveLength(1);
    expect(l.rewards[0].raw).toBe(4n * E18);
  });

  it("recompensa zerada não vira linha", () => {
    const rewards = new Map([[2n, [vr(OP, 0n)]]]);
    const [l] = buildLocks([lock({ rebase_amount: 0n })], rewards, tokens, "velodrome", 10);
    expect(l.rewards).toHaveLength(0);
  });

  it("lock vencido e SACADO (tudo zero) some da tela, como posição fechada", () => {
    const vazio = lock({ amount: 0n, rebase_amount: 0n, votes: [] });
    expect(lockHasSubstance(vazio, [])).toBe(false);
    expect(buildLocks([vazio], new Map(), tokens, "velodrome", 10)).toHaveLength(0);
  });

  it("lock com zero travado mas rebase pendente CONTINUA — é dinheiro a receber", () => {
    const soRebase = lock({ amount: 0n, rebase_amount: 1n });
    expect(buildLocks([soRebase], new Map(), tokens, "velodrome", 10)).toHaveLength(1);
  });

  it("lock depositado num gerenciado carrega o id dele (senão a tela mostrava 'vence 1970')", () => {
    const [l] = buildLocks([lock({ amount: 0n, expires_at: 0n, managed_id: 20264n })], new Map(), tokens, "velodrome", 10);
    expect(l.managedId).toBe("20264");
    expect(buildLocks([lock()], new Map(), tokens, "velodrome", 10)[0].managedId).toBeNull();
  });

  it("token sem metadado não derruba nada: cai no endereço curto", () => {
    const desconhecido = "0x000000000000000000000000000000000000dEaD" as Address;
    const [l] = buildLocks([lock({ token: desconhecido })], new Map(), tokens, "velodrome", 10);
    expect(l.token.symbol).toBe(desconhecido.slice(0, 8));
  });
});

describe("buildLockDTOs (modelo + preço → tela)", () => {
  const precos = new Map([
    [priceKey(10, VELO), 0.0341],
    [priceKey(10, OP), 0.137],
  ]);
  const agora = 1_790_000_000; // ~21/09/2026, depois do vencimento do #2
  const base = buildLocks([lock()], new Map([[2n, [vr(OP, 4n * E18)]]]), tokens, "velodrome", 10);

  it("valor = quantidade × preço", () => {
    const [d] = buildLockDTOs(base, precos, agora);
    expect(d.token.amount).toBeCloseTo(145_850, 0);
    expect(d.valueUsd).toBeCloseTo(145_850 * 0.0341, 2);
  });

  it("passou da data → VENCIDO (token liberado para saque)", () => {
    expect(buildLockDTOs(base, precos, agora)[0].expired).toBe(true);
    expect(buildLockDTOs(base, precos, 1_700_000_000)[0].expired).toBe(false);
  });

  it("lock PERMANENTE nunca vence, e data zero (gerenciado) também não conta como vencido", () => {
    const perm = buildLocks([lock({ permanent: true, expires_at: 0n })], new Map(), tokens, "velodrome", 10);
    expect(buildLockDTOs(perm, precos, agora)[0].expired).toBe(false);
    const ger = buildLocks([lock({ expires_at: 0n, managed_id: 7n })], new Map(), tokens, "velodrome", 10);
    expect(buildLockDTOs(ger, precos, agora)[0].expired).toBe(false);
  });

  it("recompensa sem preço deixa o total de recompensas em null — nunca soma parcial calada", () => {
    const comTarot = buildLocks([lock()], new Map([[2n, [vr(TAROT, 13n * E18)]]]), tokens, "velodrome", 10);
    const [d] = buildLockDTOs(comTarot, precos, agora);
    expect(d.rewards.find((r) => r.symbol === "TAROT")?.valueUsd).toBeNull();
    expect(d.rewardsUsd).toBeNull();
  });

  it("maiores primeiro", () => {
    const pequeno = buildLocks([lock({ id: 9n, amount: 1n * E18, rebase_amount: 0n })], new Map(), tokens, "velodrome", 10);
    const out = buildLockDTOs([...pequeno, ...base], precos, agora);
    expect(out.map((d) => d.lockId)).toEqual(["2", "9"]);
  });
});

describe("totais da resposta", () => {
  const precos = new Map([[priceKey(10, VELO), 0.0341]]);
  const locks = buildLocks([lock({ votes: [] })], new Map(), tokens, "velodrome", 10);

  it("travado vai para `lockedUsd`, SEPARADO do total em pools", () => {
    const dto = buildResponse({ address: "0x", normalized: [], prices: precos, scanMs: 1, warnings: [], locks, nowSec: 1_790_000_000 });
    expect(dto.totals.valueUsd).toBe(0);
    expect(dto.totals.lockedUsd).toBeCloseTo(145_850 * 0.0341, 2);
  });

  it("recompensas do lock entram no total a receber", () => {
    const dto = buildResponse({ address: "0x", normalized: [], prices: precos, scanMs: 1, warnings: [], locks, nowSec: 1_790_000_000 });
    expect(dto.totals.rewardsUsd).toBeCloseTo(1_477 * 0.0341, 2);
  });

  it("sem locks: lista vazia e travado zero (formato estável para a tela)", () => {
    const dto = buildResponse({ address: "0x", normalized: [], prices: precos, scanMs: 1, warnings: [] });
    expect(dto.locks).toEqual([]);
    expect(dto.totals.lockedUsd).toBe(0);
  });
});

describe("fmtUnixDate", () => {
  it("formata em inglês, em UTC, sem depender do locale", () => {
    expect(fmtUnixDate(1_787_875_200)).toBe("28 Aug 2026");
  });
});
