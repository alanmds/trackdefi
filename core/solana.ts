/**
 * Cliente de leitura da Solana — o equivalente de `core/chain.ts` para a
 * única rede não-EVM do site. Nada do viem se aplica aqui (endereço base58,
 * contas em vez de contratos), então o cliente é o do SDK oficial
 * (`@solana/kit`), o mesmo que o SDK da Orca espera.
 *
 * Mesma política de RPC das outras redes: os da env (SOLANA_RPC_URLS, pagos)
 * primeiro, o público depois, como reserva. O público recusa (429) com poucos
 * visitantes simultâneos — achado do PoC (poc/solana/NOTAS.md) — e serve só
 * para desenvolvimento.
 */

import { createDefaultRpcTransport, createSolanaRpcFromTransport, type RpcTransport } from "@solana/kit";
import { rpcUrls } from "./chain";
import { SOLANA_CHAIN_ID } from "./chains";

/** Tenta cada URL em ordem; só passa para a próxima se a anterior FALHOU
 *  (HTTP fora de 2xx, rede, timeout). Erro de JSON-RPC volta como resposta. */
export function fallbackTransport(transports: RpcTransport[]): RpcTransport {
  return (async (config: Parameters<RpcTransport>[0]) => {
    let last: unknown;
    for (const t of transports) {
      try {
        return await t(config);
      } catch (e) {
        last = e;
      }
    }
    throw last;
  }) as RpcTransport;
}

export function createSolanaReader() {
  const transports = rpcUrls(SOLANA_CHAIN_ID).map((url) => createDefaultRpcTransport({ url }));
  return createSolanaRpcFromTransport(fallbackTransport(transports));
}

export type SolanaReader = ReturnType<typeof createSolanaReader>;
