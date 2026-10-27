/**
 * GET /api/pool?address=0x... — dados de um pool para o simulador de APR.
 *
 * Mesma casca fina de `/api/positions`: valida, limita por IP, guarda em
 * cache por pool, com timeout. A conta da simulação NÃO roda aqui — roda no
 * navegador (`core/simulator/math.ts`), a cada mexida na faixa.
 *
 * Respostas:
 *   200  { pools: SimPoolDTO[] }  (mais de um = o endereço existe em várias redes)
 *   400  { error: "invalid" }
 *   404  { error: "not_found" }
 *   429  { error: "rate_limited" }
 *   503  { error: "busy" }
 *   502  { error: "generic" }
 *   504  { error: "timeout" }
 */

import { readFileSync } from "node:fs";
import { FixedWindowLimiter, Semaphore, TtlCache } from "../../../core/guards";
import { extractPoolAddress, lookupPool } from "../../../core/simulator/lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CACHE_TTL_MS = 60_000;
const RL_WINDOW_MS = 60_000;
const RL_MAX = 20;
const TIMEOUT_MS = 40_000;

const cache = new TtlCache<string>(CACHE_TTL_MS);
const limiter = new FixedWindowLimiter(RL_WINDOW_MS, RL_MAX);
const lookups = new Semaphore(4);

function json(body: unknown, status: number, extra?: Record<string, string>): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...(extra ?? {}) },
  });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

export async function GET(request: Request): Promise<Response> {
  const ip = (request.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!limiter.check(ip)) return json({ error: "rate_limited" }, 429);

  const pool = extractPoolAddress(new URL(request.url).searchParams.get("address") ?? "");
  if (!pool) return json({ error: "invalid" }, 400);
  const key = pool.toLowerCase();

  // Modo fixture (preview sem rede), como o de /api/positions; nunca na Vercel.
  const fixture = process.env.TRACKDEFI_POOL_FIXTURE?.trim();
  if (fixture && !process.env.VERCEL) {
    try {
      return json(readFileSync(fixture, "utf8"), 200, { "x-fixture": "1" });
    } catch {
      /* fixture ausente — segue o fluxo normal */
    }
  }

  const cached = cache.get(key);
  if (cached) return json(cached, cached.includes('"pools":[]') ? 404 : 200, { "x-cache": "HIT" });

  if (!lookups.tryAcquire()) return json({ error: "busy" }, 503, { "retry-after": "10" });
  try {
    const pools = await withTimeout(lookupPool(pool), TIMEOUT_MS);
    const body = JSON.stringify({ pools, ...(pools.length === 0 ? { error: "not_found" } : {}) });
    cache.set(key, body);
    return json(body, pools.length === 0 ? 404 : 200, { "x-cache": "MISS" });
  } catch (e) {
    if ((e as Error).message === "timeout") return json({ error: "timeout" }, 504);
    console.error(`[api/pool] falha em ${pool}:`, e);
    return json({ error: "generic" }, 502);
  } finally {
    lookups.release();
  }
}
