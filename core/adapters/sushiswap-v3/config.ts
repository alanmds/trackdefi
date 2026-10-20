/**
 * SushiSwap v3 por rede — fork da Uniswap v3 com o MESMO formato de posição,
 * pool e ticks; roda no `UniswapV3Adapter` só com config (sem subclasse).
 *
 * Endereços do repositório OFICIAL da Sushi, lidos em 20/10/2026 (é de lá que
 * docs.sushi.com tira as tabelas): github.com/sushi-labs/sushi →
 * src/evm/config/features/sushiswap-v3.ts (`SUSHISWAP_V3_FACTORY_ADDRESS`,
 * `SUSHISWAP_V3_POSITION_MANAGER`). Conferidos on-chain no
 * `poc/probe-sushiswap-v3.ts`: `NFPM.factory()` bate e o init code hash do
 * repositório reproduz o endereço do pool, rede por rede.
 *
 * Nenhuma rede usa os mesmos endereços (nem os canônicos da Uniswap). ⚠️ O
 * NFPM da Optimism tem o MESMO endereço da factory da Arbitrum — coincidência
 * de nonce do deployer, não erro de cópia (o PoC confere).
 *
 * Incentivos da Sushi v3 são pagos por Merkl (fora da cadeia) — fora do
 * escopo; mostramos só as taxas, como na Uniswap.
 */

import type { UniV3ChainConfig } from "../uniswap-v3/config";

export const SUSHISWAP_V3_ETHEREUM: UniV3ChainConfig = {
  chainId: 1,
  factory: "0xbaceb8ec6b9355dfc0269c18bac9d6e2bdc29c4f",
  nfpm: "0x2214a42d8e2a1d20635c2cb0664422c528b6a432",
};

export const SUSHISWAP_V3_OPTIMISM: UniV3ChainConfig = {
  chainId: 10,
  factory: "0x9c6522117e2ed1fe5bdb72bb0ed5e3f2bde7dbe0",
  nfpm: "0x1af415a1eba07a4986a52b6f2e7de7003d82231e",
};

export const SUSHISWAP_V3_BSC: UniV3ChainConfig = {
  chainId: 56,
  factory: "0x126555dd55a39328f69400d6ae4f782bd4c34abb",
  nfpm: "0xf70c086618dcf2b1a461311275e00d6b722ef914",
};

export const SUSHISWAP_V3_BASE: UniV3ChainConfig = {
  chainId: 8453,
  factory: "0xc35dadb65012ec5796536bd9864ed8773abc74c4",
  nfpm: "0x80c7dd17b01855a6d2347444a0fcc36136a314de",
};

export const SUSHISWAP_V3_ARBITRUM: UniV3ChainConfig = {
  chainId: 42161,
  factory: "0x1af415a1eba07a4986a52b6f2e7de7003d82231e",
  nfpm: "0xf0cbce1942a68beb3d1b73f0dd86c8dcc363ef49",
};

/** todas as redes SushiSwap v3 ativas (ordem = ordem no registry) */
export const SUSHISWAP_V3_CHAINS: UniV3ChainConfig[] = [
  SUSHISWAP_V3_BASE,
  SUSHISWAP_V3_ETHEREUM,
  SUSHISWAP_V3_ARBITRUM,
  SUSHISWAP_V3_OPTIMISM,
  SUSHISWAP_V3_BSC,
];
