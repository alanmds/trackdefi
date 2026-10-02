/**
 * Ramses V3 (liquidez concentrada) por rede. Endereços CONFIRMADOS na doc
 * oficial em 02/10/2026 (www.ramses.xyz/docs/contract-addresses) e conferidos
 * on-chain no `poc/probe-ramses.ts`: `NFPM.deployer()` bate com o
 * RamsesV3PoolDeployer da doc (este NFPM não tem `factory()`).
 *
 * Redes ativas: Robinhood (no ar em 02/10/2026) e HyperEVM (passo 1 do plano
 * de cobertura total, 02/10/2026) — a HyperEVM é a única com gauges, onde a
 * Ramses paga RAM às posições sem stake. Arbitrum e Polygon ficaram de fora
 * por decisão do Alan: quase sem liquidez (49 e 35 posições no total).
 */

import type { Address } from "viem";
import type { UniV3ChainConfig } from "../uniswap-v3/config";

export interface RamsesV3ChainConfig extends UniV3ChainConfig {
  /**
   * FeeCollector da doc. Serve para achar o Voter (`FeeCollector.voter()`),
   * que a doc NÃO lista em todas as redes; Voter zero = rede sem gauges.
   */
  feeCollector: Address;
}

export const RAMSES_V3_ROBINHOOD: RamsesV3ChainConfig = {
  chainId: 4663,
  factory: "0xE0c4ceb92d08CA985bB70fe0a22fEb121A9854A8",
  nfpm: "0x2eBd7B85a4E08D5B508b04BA147976C94afE6590",
  feeCollector: "0x2Bef16A0081565E72100D73CBe19B1Bd2d802380",
};

export const RAMSES_V3_HYPEREVM: RamsesV3ChainConfig = {
  chainId: 999,
  factory: "0x07E60782535752be279929e2DFfDd136Db2e6b45",
  nfpm: "0xB3F77C5134D643483253D22E0Ca24627aE42ED51",
  feeCollector: "0xA22fc9950bE328D8a32a8c1e2c92eAc4e6bADa00",
};

/** todas as redes Ramses ATIVAS (ordem = ordem no registry) */
export const RAMSES_V3_CHAINS: RamsesV3ChainConfig[] = [RAMSES_V3_ROBINHOOD, RAMSES_V3_HYPEREVM];
