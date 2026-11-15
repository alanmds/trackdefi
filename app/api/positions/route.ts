/**
 * GET /api/positions?address=0x... (EVM) ou ?address=<base58> (Solana)
 *
 * Casca fina de HTTP sobre core/service (mesma filosofia da CLI): valida o
 * endereço, aplica rate-limit por IP e cache por carteira, com timeout e
 * mensagens de erro limpas. Nenhuma chave privada trafega — só leitura pública.
 * As travas moram em `app/api/wallet-scan.ts`, divididas com o servidor MCP.
 *
 * Respostas:
 *   200  DTO de PositionsResponse (header x-cache: HIT|MISS)
 *   400  { error: "invalid_address" }
 *   429  { error: "rate_limited" }
 *   502  { error: "upstream" }   — RPC/rede falhou
 *   503  { error: "busy" }       — fila de varreduras cheia
 *   504  { error: "timeout" }
 */

import { clientIp, scanWallet, type ScanErrorCode } from "../wallet-scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // teto da função (conferir limite do plano Vercel na Fase 6)

/**
 * Cache da CDN (13/11/2026): a mesma carteira lida de novo dentro de 5 min sai
 * da borda, sem acordar a função — na Vercel grátis a CPU ativa é o que acaba
 * (4 h/30 dias). `max-age=0` mantém o navegador sempre perguntando à borda;
 * `stale-while-revalidate` serve a cópia velha enquanto uma nova é lida. Só
 * respostas 200: erro, 429 e 503 nunca são guardados.
 */
const CDN_CACHE = "public, max-age=0, s-maxage=300, stale-while-revalidate=900";

const STATUS: Record<ScanErrorCode, number> = {
  invalid_address: 400,
  rate_limited: 429,
  upstream: 502,
  busy: 503,
  timeout: 504,
};

function jsonResponse(body: unknown, status: number, extra?: Record<string, string>): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      ...(extra ?? {}),
    },
  });
}

export function OPTIONS(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get("address") ?? "";
  const r = await scanWallet(clientIp(request), raw);

  if (!r.ok) {
    return jsonResponse(
      { error: r.code, message: r.message },
      STATUS[r.code],
      r.code === "busy" ? { "retry-after": "10" } : undefined,
    );
  }
  if (r.source === "fixture") return jsonResponse(r.body, 200, { "x-fixture": "1" });
  return jsonResponse(r.body, 200, {
    "x-cache": r.source === "cache" ? "HIT" : "MISS",
    "cache-control": CDN_CACHE,
  });
}
