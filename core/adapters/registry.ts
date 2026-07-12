/**
 * Registry de adapters: a ÚNICA lista de protocolos/redes ativos.
 * Adicionar protocolo/rede = instanciar aqui (Receitas A/B do playbook).
 * Cada adapter recebe o reader da SUA rede (core/chain.ts).
 */

import type { ChainReader, ProtocolAdapter } from "../types";
import { createReader } from "../chain";
import { AerodromeAdapter } from "./aerodrome/index";
import { VELODROME_OPTIMISM } from "./aerodrome/config";
import { UniswapV3Adapter } from "./uniswap-v3/index";
import { UNISWAP_V3_CHAINS } from "./uniswap-v3/config";

export function buildAdapters(opts: { onWarn?: (msg: string) => void } = {}): ProtocolAdapter[] {
  // um reader por rede, compartilhado entre os adapters daquela rede
  const readers = new Map<number, ChainReader>();
  const readerFor = (chainId: number) => {
    if (!readers.has(chainId)) readers.set(chainId, createReader(chainId));
    return readers.get(chainId)!;
  };

  return [
    new AerodromeAdapter(readerFor(8453), opts),
    new AerodromeAdapter(readerFor(10), { ...opts, config: VELODROME_OPTIMISM }),
    ...UNISWAP_V3_CHAINS.map((config) => new UniswapV3Adapter(readerFor(config.chainId), { ...opts, config })),
  ];
}
