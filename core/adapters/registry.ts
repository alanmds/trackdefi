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
import { PancakeV3Adapter } from "./pancake-v3/index";
import { PANCAKE_V3_CHAINS } from "./pancake-v3/config";
import { SUSHISWAP_V3_CHAINS } from "./sushiswap-v3/config";
import { RamsesV3Adapter } from "./ramses-v3/index";
import { RAMSES_V3_CHAINS } from "./ramses-v3/config";
import { OrcaAdapter } from "./orca/index";
import { ClassicV2Adapter } from "./classic-v2/index";
import { CLASSIC_V2_PROTOCOLS } from "./classic-v2/config";
import { createSolanaReader } from "../solana";

/** o protocolo clássico que fala pela rede (o primeiro da lista que a tem) */
function firstClassicProtocolOn(chainId: number): string | undefined {
  return CLASSIC_V2_PROTOCOLS.find((p) => p.chains.some((c) => c.chainId === chainId))?.protocol;
}

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
    ...PANCAKE_V3_CHAINS.map((config) =>
      tagged((onWarn) => new PancakeV3Adapter(readerFor(config.chainId), { onWarn, config })),
    ),
    // SushiSwap v3: fork com o formato da Uniswap — mesmo adapter, só config
    ...SUSHISWAP_V3_CHAINS.map((config) =>
      tagged((onWarn) => new UniswapV3Adapter(readerFor(config.chainId), { onWarn, config, protocol: "sushiswap-v3" })),
    ),
    ...RAMSES_V3_CHAINS.map((config) =>
      tagged((onWarn) => new RamsesV3Adapter(readerFor(config.chainId), { onWarn, config })),
    ),
    // Pools clássicos (v2): LP token na carteira, achado pela Token API da Alchemy.
    // A varredura é uma por rede; só o primeiro protocolo de cada rede avisa o teto.
    ...CLASSIC_V2_PROTOCOLS.flatMap(({ protocol, chains }) =>
      chains.map((config) =>
        tagged(
          (onWarn) =>
            new ClassicV2Adapter(readerFor(config.chainId), {
              onWarn,
              config,
              protocol,
              reportsCap: protocol === firstClassicProtocolOn(config.chainId),
            }),
        ),
      ),
    ),
    // Solana: motor próprio, sem viem (core/solana.ts)
    tagged((onWarn) => new OrcaAdapter(createSolanaReader(), { onWarn })),
  ];
}
