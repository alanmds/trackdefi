/**
 * GET /api/pairs — a tabela da descoberta de pares (core/discovery/pairs.ts).
 *
 * É a MESMA resposta para todo mundo: os filtros rodam no navegador. Cache de
 * 10 min por instância e na CDN (`s-maxage`) — o dataset da DefiLlama só muda
 * ~1 vez por hora, e assim a maioria das visitas nem chega à função.
 *
 * Respostas: 200 PairsDTO · 429 rate_limited · 502 generic
 */

import { readFileSync } from "node:fs";
import { FixedWindowLimiter, TtlCache } from "../../../core/guards";
import { loadPairs } from "../../../core/discovery/pairs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TTL_MS = 10 * 60_000;
const cache = new TtlCache<string>(TTL_MS);
const limiter = new FixedWindowLimiter(60_000, 20);

function json(body: string, status: number, extra?: Record<string, string>): Response {
  return new Response(body, { status, headers: { "content-type": "application/json; charset=utf-8", ...(extra ?? {}) } });
}

export async function GET(request: Request): Promise<Response> {
  const ip = (request.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!limiter.check(ip)) return json(JSON.stringify({ error: "rate_limited" }), 429);

  // Modo fixture (preview sem rede), como os outros; nunca na Vercel.
  const fixture = process.env.TRACKDEFI_PAIRS_FIXTURE?.trim();
  if (fixture && !process.env.VERCEL) {
    try {
      return json(readFileSync(fixture, "utf8"), 200, { "x-fixture": "1" });
    } catch {
      /* fixture ausente — segue o fluxo normal */
    }
  }

  const cdn = { "cache-control": "public, s-maxage=600, stale-while-revalidate=3000" };
  const cached = cache.get("pairs");
  if (cached) return json(cached, 200, { ...cdn, "x-cache": "HIT" });
  try {
    const body = JSON.stringify(await loadPairs());
    cache.set("pairs", body);
    return json(body, 200, { ...cdn, "x-cache": "MISS" });
  } catch (e) {
    console.error("[api/pairs] falha:", e);
    return json(JSON.stringify({ error: "generic" }), 502);
  }
}
