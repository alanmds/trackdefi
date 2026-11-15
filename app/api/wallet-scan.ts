/**
 * Varredura de uma carteira com as travas do servidor — compartilhada por
 * `/api/positions` (o site) e `/api/mcp` (agentes de IA) desde 15/11/2026.
 *
 * As duas portas dividem o MESMO cache, o MESMO limite por IP e a MESMA fila
 * de varreduras: um agente não ganha mais cota de RPC do que um visitante, e
 * a mesma carteira lida pelos dois sai do cache na segunda vez.
 *
 * Estado por instância — ver LIMITAÇÃO em core/guards.ts.
 */

import { readFileSync } from "node:fs";
import { parseWalletAddress } from "../../core/address";
import { getWalletPositions } from "../../core/service";
import { FixedWindowLimiter, Semaphore, TtlCache } from "../../core/guards";
import { isHostedServer } from "./hosting";

const CACHE_TTL_MS = 60_000;
const RL_WINDOW_MS = 60_000;
const RL_MAX = 30; // requisições por IP por minuto
const SCAN_TIMEOUT_MS = 50_000;

const MAX_CONCURRENT_SCANS = 4; // varreduras simultâneas por instância (protege a cota do RPC)

const cache = new TtlCache<string>(CACHE_TTL_MS);
const limiter = new FixedWindowLimiter(RL_WINDOW_MS, RL_MAX);
const scans = new Semaphore(MAX_CONCURRENT_SCANS);

export type ScanErrorCode = "rate_limited" | "invalid_address" | "busy" | "timeout" | "upstream";

export type ScanResult =
  | {
      ok: true;
      /** DTO de `PositionsResponseDTO`, já em JSON */
      body: string;
      /** endereço normalizado */
      address: string;
      source: "cache" | "scan" | "fixture";
    }
  | { ok: false; code: ScanErrorCode; message: string };

/** IP de quem chamou (primeiro da cadeia do proxy) */
export function clientIp(request: Request): string {
  return (request.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

/**
 * Lê as posições de `rawAddress` para quem está em `ip`. Mensagens em inglês,
 * próprias para a tela e para um agente — nunca o motivo interno do erro.
 */
export async function scanWallet(ip: string, rawAddress: string): Promise<ScanResult> {
  if (!limiter.check(ip)) {
    return { ok: false, code: "rate_limited", message: "Too many requests. Try again in a few seconds." };
  }

  const parsed = parseWalletAddress(rawAddress.trim());
  if (!parsed) {
    return { ok: false, code: "invalid_address", message: "Invalid wallet address." };
  }
  const address = parsed.address;
  // EVM ignora a caixa; base58 NÃO (outra caixa = outra carteira)
  const cacheKey = parsed.kind === "evm" ? address.toLowerCase() : address;

  // Modo fixture (dev/preview sem rede): serve um DTO congelado do disco.
  // Ignorado no servidor publicado por segurança (ver app/api/hosting.ts).
  const fixturePath = process.env.TRACKDEFI_FIXTURE?.trim();
  if (fixturePath && !isHostedServer()) {
    try {
      return { ok: true, body: readFileSync(fixturePath, "utf8"), address, source: "fixture" };
    } catch {
      /* fixture ausente — segue o fluxo normal */
    }
  }

  const cached = cache.get(cacheKey);
  if (cached) return { ok: true, body: cached, address, source: "cache" };

  if (!scans.tryAcquire()) {
    return {
      ok: false,
      code: "busy",
      message: "The server is scanning other wallets right now. Try again in a few seconds.",
    };
  }

  try {
    const dto = await withTimeout(getWalletPositions(address), SCAN_TIMEOUT_MS);
    const body = JSON.stringify(dto);
    cache.set(cacheKey, body);
    return { ok: true, body, address, source: "scan" };
  } catch (e) {
    if ((e as Error).message === "timeout") {
      return { ok: false, code: "timeout", message: "The blockchain read took too long. Please try again." };
    }
    console.error(`[wallet-scan] upstream failure for ${address}:`, e);
    return { ok: false, code: "upstream", message: "Failed to read the blockchain. Try again in a moment." };
  } finally {
    scans.release();
  }
}
