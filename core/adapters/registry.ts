/**
 * Registry de adapters: a ÚNICA lista de protocolos/redes ativos.
 * Adicionar protocolo/rede = instanciar aqui (Receitas A/B do playbook).
 * Cada adapter recebe o reader da SUA rede (core/chain.ts).
 */

import type { ProtocolAdapter } from "../types";
import { createReader } from "../chain";
import { AerodromeAdapter } from "./aerodrome/index";
import { VELODROME_OPTIMISM } from "./aerodrome/config";
import { UniswapV3Adapter } from "./uniswap-v3/index";

export function buildAdapters(opts: { onWarn?: (msg: string) => void } = {}): ProtocolAdapter[] {
  const baseReader = createReader(8453);
  const opReader = createReader(10);
  return [
    new AerodromeAdapter(baseReader, opts),
    new UniswapV3Adapter(baseReader, opts),
    new AerodromeAdapter(opReader, { ...opts, config: VELODROME_OPTIMISM }),
  ];
}
