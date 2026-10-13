/**
 * PancakeSwap v3 por rede. Endereços CONFIRMADOS na documentação oficial em
 * 12/10/2026 (developer.pancakeswap.finance → contracts/v3/addresses,
 * contracts/cake) e conferidos on-chain no `poc/probe-pancake-v3.ts`
 * (`NFPM.factory()`, `NFPM.deployer()`, `MasterChef.nonfungiblePositionManager()`
 * e `MasterChef.CAKE()` batem com a doc, rede por rede).
 *
 * O que a doc diz, e o PoC confirmou, sobre as QUATRO redes:
 * - factory e PoolDeployer são os MESMOS endereços em todas (a tabela "Core"
 *   lista BSC, ETH, ARB e Base na mesma coluna);
 * - o NonfungiblePositionManager TAMBÉM é o mesmo nas quatro (a tabela
 *   "Periphery" lista "BSC, ETH, Arbitrum, Linea, Base, opBNB, Monad" numa
 *   coluna só). ℹ️ Isto corrige o palpite anotado no playbook em 02/10/2026
 *   ("ARB e Base têm NFPM próprio") — a doc de hoje não diz isso, e a leitura
 *   on-chain concorda com a doc: `MasterChef.nonfungiblePositionManager()`
 *   devolve o MESMO NFPM nas quatro redes;
 * - o MasterChef v3 é igual só em BSC e ETH; Arbitrum e Base têm o seu;
 * - o CAKE tem endereço próprio em cada rede (página contracts/cake) — daí o
 *   campo `cake` ser por rede, e não um só.
 */

import type { Address } from "viem";
import type { TokenInfo } from "../../types";
import type { UniV3ChainConfig } from "../uniswap-v3/config";

export interface PancakeV3ChainConfig extends UniV3ChainConfig {
  /** MasterChef v3 — guarda os NFTs em stake e paga CAKE */
  masterChef: Address;
  /** token de emissão do MasterChef (`MasterChef.CAKE()`). Símbolo e casas como o
   *  próprio token responde on-chain ("Cake", 18) — o mesmo que aparece nos pares. */
  cake: TokenInfo;
}

export const PANCAKE_V3_BSC: PancakeV3ChainConfig = {
  chainId: 56,
  factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
  nfpm: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
  masterChef: "0x556B9306565093C855AEA9AE92A594704c2Cd59e",
  cake: { address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", symbol: "Cake", decimals: 18 },
};

/** Ethereum: NFPM e MasterChef v3 IGUAIS aos da BNB; CAKE próprio. */
export const PANCAKE_V3_ETHEREUM: PancakeV3ChainConfig = {
  chainId: 1,
  factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
  nfpm: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
  masterChef: "0x556B9306565093C855AEA9AE92A594704c2Cd59e",
  cake: { address: "0x152649eA73beAb28c5b49B26eb48f7EAD6d4c898", symbol: "Cake", decimals: 18 },
};

/** Base: MasterChef v3 PRÓPRIO; NFPM e CAKE conferidos no PoC de 12/10/2026. */
export const PANCAKE_V3_BASE: PancakeV3ChainConfig = {
  chainId: 8453,
  factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
  nfpm: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
  masterChef: "0xC6A2Db661D5a5690172d8eB0a7DEA2d3008665A3",
  cake: { address: "0x3055913c90Fcc1A6CE9a358911721eEb942013A1", symbol: "Cake", decimals: 18 },
};

/** Arbitrum One: MasterChef v3 PRÓPRIO; NFPM e CAKE conferidos no PoC de 12/10/2026. */
export const PANCAKE_V3_ARBITRUM: PancakeV3ChainConfig = {
  chainId: 42161,
  factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
  nfpm: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
  masterChef: "0x5e09ACf80C0296740eC5d6F643005a4ef8DaA694",
  cake: { address: "0x1b896893dfc86bb67Cf57767298b9073D2c1bA2c", symbol: "Cake", decimals: 18 },
};

/** todas as redes PancakeSwap v3 ativas (ordem = ordem no registry) */
export const PANCAKE_V3_CHAINS: PancakeV3ChainConfig[] = [
  PANCAKE_V3_BSC,
  PANCAKE_V3_ETHEREUM,
  PANCAKE_V3_BASE,
  PANCAKE_V3_ARBITRUM,
];

/**
 * O `cakePerSecond` do MasterChef v3 vem multiplicado por esta precisão.
 * PROVADO no PoC de 02/10/2026 (BNB) e REFEITO em 12/10/2026 na Ethereum: com
 * ÷ 1e12, a previsão do CAKE/s de uma posição bate com o `pendingCake` medido
 * crescendo (razões em `poc/probe-pancake-v3.ts`, seção 6b).
 */
export const CAKE_PER_SECOND_PRECISION = 10n ** 12n;
