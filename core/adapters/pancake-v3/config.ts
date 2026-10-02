/**
 * PancakeSwap v3 por rede. Endereços CONFIRMADOS na documentação oficial em
 * 02/10/2026 (developer.pancakeswap.finance → contracts/v3/addresses e
 * contracts/masterchef/masterchef-v3) e conferidos on-chain no
 * `poc/probe-pancake-v3.ts`: `NFPM.factory()`, `NFPM.deployer()` e
 * `MasterChef.nonfungiblePositionManager()` batem com a doc.
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

/** todas as redes PancakeSwap v3 ativas (ordem = ordem no registry) */
export const PANCAKE_V3_CHAINS: PancakeV3ChainConfig[] = [PANCAKE_V3_BSC];

/**
 * O `cakePerSecond` do MasterChef v3 vem multiplicado por esta precisão.
 * PROVADO no PoC de 02/10/2026: com ÷ 1e12, a previsão do CAKE/s de uma
 * posição bateu com o `pendingCake` medido crescendo por 60 s (razão 1,016 e
 * 0,996 em duas posições).
 */
export const CAKE_PER_SECOND_PRECISION = 10n ** 12n;
