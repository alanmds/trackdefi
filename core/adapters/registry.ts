/**
 * Registry de adapters: a ÚNICA lista de protocolos/redes ativos.
 * Adicionar protocolo/rede = instanciar aqui (Receitas A/B do playbook).
 * Cada adapter recebe o reader da SUA rede (core/chain.ts).
 */

import type { AdapterNotice, ChainReader, ProtocolAdapter, WarnSink } from "../types";
import { createReader } from "../chain";
import { AerodromeAdapter } from "./aerodrome/index";
import { VELODROME_LEAF_CHAINS, VELODROME_OPTIMISM } from "./aerodrome/config";
import { UniswapV3Adapter } from "./uniswap-v3/index";
import { UNISWAP_V3_CHAINS } from "./uniswap-v3/config";
import { UniswapV4Adapter } from "./uniswap-v4/index";
import { UNISWAP_V4_CHAINS } from "./uniswap-v4/config";

/** Recebe o aviso junto com QUEM avisou — a tela precisa dizer "Uniswap v4
 *  na Robinhood Chain", não um genérico "algo falhou". */
export type AdapterWarn = (msg: string, notice: AdapterNotice | null | undefined, source: ProtocolAdapter) => void;

export function buildAdapters(opts: { onWarn?: AdapterWarn } = {}): ProtocolAdapter[] {
  // um reader por rede, compartilhado entre os adapters daquela rede
  const readers = new Map<number, ChainReader>();
  const readerFor = (chainId: number) => {
    if (!readers.has(chainId)) readers.set(chainId, createReader(chainId));
    return readers.get(chainId)!;
  };
  /* o adapter só avisa durante a varredura, bem depois do construtor — então
     a referência a ele já existe quando o primeiro aviso chega */
  const tagged = <T extends ProtocolAdapter>(make: (onWarn: WarnSink) => T): T => {
    let self: T | undefined = undefined;
    self = make((msg, notice) => {
      if (self) opts.onWarn?.(msg, notice, self);
    });
    return self;
  };

  return [
    tagged((onWarn) => new AerodromeAdapter(readerFor(8453), { onWarn })),
    tagged((onWarn) => new AerodromeAdapter(readerFor(10), { onWarn, config: VELODROME_OPTIMISM })),
    ...VELODROME_LEAF_CHAINS.map((config) =>
      tagged((onWarn) => new AerodromeAdapter(readerFor(config.chainId), { onWarn, config })),
    ),
    ...UNISWAP_V3_CHAINS.map((config) =>
      tagged((onWarn) => new UniswapV3Adapter(readerFor(config.chainId), { onWarn, config })),
    ),
    ...UNISWAP_V4_CHAINS.map((config) =>
      tagged((onWarn) => new UniswapV4Adapter(readerFor(config.chainId), { onWarn, config })),
    ),
  ];
}
