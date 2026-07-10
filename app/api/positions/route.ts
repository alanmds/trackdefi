/**
 * GET /api/positions?address=0x...
 *
 * Casca fina de HTTP sobre core/service (mesma filosofia da CLI): valida o
 * endereço, aplica rate-limit por IP e cache por carteira, com timeout e
 * mensagens de erro limpas. Nenhuma chave privada trafega — só leitura pública.
 *
 * Respostas:
 *   200  DTO de PositionsResponse (header x-cache: HIT|MISS)
 *   400  { error: "invalid_address" }
 *   429  { error: "rate_limited" }
 *   502  { error: "upstream" }   — RPC/rede falhou
 *   504  { error: "timeout" }
 */

import { getAddress, isAddress } from "viem";
import { createBaseReader } from "../../../core/chain";
import { getWalletPositions } from "../../../core/service";
import { FixedWindowLimiter, TtlCache } from "../../../core/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // teto da função (conferir limite do plano Vercel na Fase 6)

const CACHE_TTL_MS = 60_000;
const RL_WINDOW_MS = 60_000;
const RL_MAX = 30; // requisições por IP por minuto
const SCAN_TIMEOUT_MS = 50_000;

// Estado por instância — ver LIMITAÇÃO em core/guards.ts.
const cache = new TtlCache<string>(CACHE_TTL_MS);
const limiter = new FixedWindowLimiter(RL_WINDOW_MS, RL_MAX);

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

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
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
  const ip = (request.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!limiter.check(ip)) {
    return jsonResponse({ error: "rate_limited", message: "Muitas requisições. Tente novamente em instantes." }, 429);
  }

  const raw = new URL(request.url).searchParams.get("address")?.trim() ?? "";
  if (!isAddress(raw)) {
    return jsonResponse({ error: "invalid_address", message: "Endereço de carteira inválido." }, 400);
  }
  const address = getAddress(raw);
  const cacheKey = address.toLowerCase();

  const cached = cache.get(cacheKey);
  if (cached) return jsonResponse(cached, 200, { "x-cache": "HIT" });

  try {
    const dto = await withTimeout(getWalletPositions(createBaseReader(), address), SCAN_TIMEOUT_MS);
    const body = JSON.stringify(dto);
    cache.set(cacheKey, body);
    return jsonResponse(body, 200, { "x-cache": "MISS" });
  } catch (e) {
    if ((e as Error).message === "timeout") {
      return jsonResponse({ error: "timeout", message: "A leitura da blockchain demorou demais. Tente novamente." }, 504);
    }
    return jsonResponse({ error: "upstream", message: "Falha ao ler a blockchain. Tente novamente em instantes." }, 502);
  }
}
