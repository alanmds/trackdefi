/**
 * Aero (fusão da Aerodrome com a Velodrome, no ar desde 22/10/2026) —
 * liquidez concentrada (Slipstream v2). Endereços da lista OFICIAL
 * (https://app.aero.xyz/docs/security) e dos repositórios
 * github.com/dromos-labs/metadex-public e metadex-slipstream-public (pasta
 * `deployment-addresses/`), conferidos em 31/10/2026 e provados on-chain em
 * `poc/probe-aero.ts`: `NFPM.factory()` devolve o `clFactory` de cada rede.
 *
 * Fatos que moldam o adapter (todos provados no PoC):
 * - o position manager tem o MESMO endereço em todas as redes;
 * - NÃO existe Sugar da Aero: as posições vêm dos NFTs da carteira + dos
 *   gauges (cada pool CL tem `gauge()`; o gauge guarda o NFT e responde
 *   `stakedValues(conta)`);
 * - o gauge paga em `ReceiptToken` (xAERO), resgatável 1:1 por AERO na Base
 *   (ILeafVoter oficial: `mintEmissions`/`redeem`) — por isso a recompensa
 *   sai como xAERO, com o preço do AERO.
 */

import type { Address } from "viem";
import type { UniV3ChainConfig } from "../uniswap-v3/config";
import type { TokenInfo } from "../../types";

/** `factory` (herdado) = o CLFactory da rede */
export interface AeroChainConfig extends UniV3ChainConfig {
  /** xAERO (`ReceiptToken`) desta rede: o que o gauge paga */
  receiptToken: TokenInfo;
}

const NFPM: Address = "0x4857DB576eE0e45F10525eC59527BfD10beeC60b";

const xaero = (address: Address): TokenInfo => ({ address, symbol: "xAERO", decimals: 18 });

/** AERO (token de governança) — só existe na Base; as outras redes têm o xAERO */
export const AERO_TOKEN_BASE: Address = "0x3f5bF3EdAc59d650D8fDf9657a71F2f904A3a4Ee";

export const AERO_BASE: AeroChainConfig = {
  chainId: 8453,
  factory: "0x9CB220581b91b0C83223012FE69688b92aD07a76",
  nfpm: NFPM,
  receiptToken: xaero("0x6CdDa0E730744DC6fF67654B35350Adad05EceE7"),
};

export const AERO_OPTIMISM: AeroChainConfig = {
  chainId: 10,
  factory: "0xfeaB42D90055db3a0616249f76B6002D72266778",
  nfpm: NFPM,
  receiptToken: xaero("0xbdEaeA5205d16f34Cb40038052d91235D87B4C54"),
};

export const AERO_ARBITRUM: AeroChainConfig = {
  chainId: 42161,
  factory: "0x88a60ee77392577c355C0acb2A8d476D5a4EC03a",
  nfpm: NFPM,
  receiptToken: xaero("0x436a085B2751cB87db270FFa66f8d698F87bEC82"),
};

/** Ethereum, Ink e Robinhood dividem o mesmo xAERO */
const XAERO_ETH_INK_ROBINHOOD: Address = "0x9e148C5716b5aAdCFD3B71cEAE9EE7a9e22C29E2";

export const AERO_ETHEREUM: AeroChainConfig = {
  chainId: 1,
  factory: "0xF4Fd2E6c5B60c5b365cd1B96DD6245E6D60414c2",
  nfpm: NFPM,
  receiptToken: xaero(XAERO_ETH_INK_ROBINHOOD),
};

export const AERO_INK: AeroChainConfig = {
  chainId: 57073,
  factory: "0x7660BF2aDefC687C22906112ca323d60A00358cF",
  nfpm: NFPM,
  receiptToken: xaero(XAERO_ETH_INK_ROBINHOOD),
};

export const AERO_ROBINHOOD: AeroChainConfig = {
  chainId: 4663,
  factory: "0xc63d7338c178e805c544B8f897066bD3BBcBE136",
  nfpm: NFPM,
  receiptToken: xaero(XAERO_ETH_INK_ROBINHOOD),
};

/** redes ativas (ordem = ordem no registry). A Arc fica de fora: o site não a tem. */
export const AERO_CHAINS: AeroChainConfig[] = [
  AERO_BASE,
  AERO_OPTIMISM,
  AERO_ARBITRUM,
  AERO_ETHEREUM,
  AERO_INK,
  AERO_ROBINHOOD,
];
