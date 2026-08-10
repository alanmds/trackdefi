/**
 * Uniswap V4 por rede. Endereços CONFIRMADOS na documentação oficial
 * (developers.uniswap.org → v4 → deployments) em 10/08/2026 e conferidos
 * on-chain nos PoCs `poc/probe-uniswap-v4.ts` e `poc/probe-uniswap-v4-read.ts`.
 *
 * ⚠️ Por que só a Robinhood Chain está aqui, se o v4 também roda na Base:
 * o v4 exige varrer o histórico de `Transfer` do PositionManager para
 * descobrir as posições da carteira (ver `index.ts`). O RPC público da
 * Robinhood aceita a chain inteira numa chamada; **na Base nenhum dos 8 RPCs
 * públicos testados aceita** (10.000 blocos no melhor caso). A Base entra
 * quando houver RPC que aguente — a config abaixo é a única coisa a
 * acrescentar. Endereços da Base, já confirmados na doc, para quando for:
 *   positionManager 0x7c5f5a4bbd8fd63184577525326123b519429bdc
 *   stateView       0xa3c0c9b65bad0b08107aa264b0f3db444b867a71
 */

import type { Address } from "viem";

export interface UniV4ChainConfig {
  chainId: number;
  /** ERC-721 das posições; NÃO é enumerável (ver index.ts) */
  positionManager: Address;
  /** leitor do estado do singleton PoolManager */
  stateView: Address;
  /**
   * O singleton onde TODOS os pools da rede vivem. No v4 um pool não tem
   * endereço próprio, então é este que vai no `poolAddress` do modelo — é o
   * contrato que de fato guarda a posição, e é para ele que o link do
   * explorer aponta. Consequência aceita: duas posições em pools v4
   * diferentes compartilham o `poolAddress`. Nada quebra com isso — a chave
   * de lista usa o id do NFT, e o casamento de APR por endereço de pool não
   * acha o singleton (o APR sai "—", que é o correto aqui).
   */
  poolManager: Address;
}

export const UNISWAP_V4_ROBINHOOD: UniV4ChainConfig = {
  chainId: 4663,
  positionManager: "0x58daec3116aae6d93017baaea7749052e8a04fa7",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
  poolManager: "0x8366a39cc670b4001a1121b8f6a443a643e40951",
};

/** todas as redes Uniswap v4 ativas (ordem = ordem no registry) */
export const UNISWAP_V4_CHAINS: UniV4ChainConfig[] = [UNISWAP_V4_ROBINHOOD];

/** teto de NFTs de posição por carteira (evita carteira-robô derrubar a varredura) */
export const MAX_V4_NFTS = 400;
