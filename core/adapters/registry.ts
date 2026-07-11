/**
 * Registry de adapters: a ÚNICA lista de protocolos ativos.
 * Adicionar protocolo/rede = instanciar aqui (Receitas A/B do playbook).
 */

import type { ChainReader, ProtocolAdapter } from "../types";
import { AerodromeAdapter } from "./aerodrome/index";
import { UniswapV3Adapter } from "./uniswap-v3/index";

export function buildAdapters(
  reader: ChainReader,
  opts: { onWarn?: (msg: string) => void } = {},
): ProtocolAdapter[] {
  return [new AerodromeAdapter(reader, opts), new UniswapV3Adapter(reader, opts)];
}
