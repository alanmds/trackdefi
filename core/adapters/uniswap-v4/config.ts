/**
 * Uniswap V4 por rede. Endereços CONFIRMADOS na documentação oficial
 * (developers.uniswap.org → v4 → deployments) em 10/08/2026 e conferidos
 * on-chain nos PoCs `poc/probe-uniswap-v4.ts` e `poc/probe-uniswap-v4-read.ts`.
 *
 * ⚠️ Como cada rede é enumerada (ver `index.ts`): o v4 exige descobrir os NFTs
 * da carteira pelo histórico de `Transfer` do PositionManager — ele não é
 * enumerável. O RPC público da Robinhood aceita a chain inteira numa chamada;
 * **na Base nenhum dos 8 RPCs públicos testados aceita** (10.000 blocos no
 * melhor caso) e na BNB o público aceita só 2.000 por chamada contra 126M de
 * blocos (medido em `poc/probe-v4-bnb-varredura.ts`). Onde a varredura não
 * cabe, `enumeration: "index"` enumera pela API indexada do próprio RPC
 * (`alchemy_getAssetTransfers`) — é o "caminho alternativo já testado" que o
 * roadmap promete, e o que faz a posição v4 da BNB aparecer.
 *
 * A Base entra com a mesma receita (endereços já confirmados na doc):
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
  /**
   * Como descobrir OS NFTs DA CARTEIRA nesta rede:
   *  - `"logs"` (padrão): varredura de `Transfer` do início da chain — só onde
   *    o RPC aguenta a faixa inteira (Robinhood);
   *  - `"index"`: API indexada do próprio RPC (`alchemy_getAssetTransfers`),
   *    que devolve o que a carteira recebeu sem varrer bloco a bloco — usado
   *    onde nenhum RPC aguenta a varredura (BNB). Exige `<REDE>_RPC_URLS` com
   *    Alchemy; sem ela o adapter tenta a varredura e, se falhar, avisa.
   * As duas fontes dão os MESMOS candidatos (quem recebeu), e `ownerOf`
   * confirma em seguida — ver `index.ts`.
   */
  enumeration?: "logs" | "index";
};

export const UNISWAP_V4_ROBINHOOD: UniV4ChainConfig = {
  chainId: 4663,
  positionManager: "0x58daec3116aae6d93017baaea7749052e8a04fa7",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
  poolManager: "0x8366a39cc670b4001a1121b8f6a443a643e40951",
};

/**
 * BNB Chain. Endereços da doc OFICIAL (developers.uniswap.org →
 * docs/protocols/v4/deployments → BNB Smart Chain: 56) lidos em 06/10/2026 e
 * conferidos on-chain no `poc/probe-v4-bnb.ts` (`name()` = "Uniswap v4
 * Positions NFT"). Entrou porque carteiras reais tinham posição v4 na BNB, rede
 * que não estava no registry.
 */
export const UNISWAP_V4_BSC: UniV4ChainConfig = {
  chainId: 56,
  positionManager: "0x7a4a5c919ae2541aed11041a1aeee68f1287f95b",
  stateView: "0xd13dd3d6e93f276fafc9db9e6bb47c1180aee0c4",
  poolManager: "0x28e2ea090877bf75740558f6bfb36a5ffee9e9df",
  enumeration: "index",
};

/** todas as redes Uniswap v4 ativas (ordem = ordem no registry) */
export const UNISWAP_V4_CHAINS: UniV4ChainConfig[] = [UNISWAP_V4_ROBINHOOD, UNISWAP_V4_BSC];

/** teto de NFTs de posição por carteira (evita carteira-robô derrubar a varredura) */
export const MAX_V4_NFTS = 400;

/** teto de páginas da API indexada (100 transferências por página) */
export const MAX_INDEX_PAGES = 40;

/** varredura de `Transfer`: faixa (em blocos) abaixo da qual não se parte mais, só se repete */
export const MIN_LOG_SPAN = 200_000n;
/** repetições de uma faixa curta que o RPC recusou */
export const LOG_RETRIES = 2;
/** teto de chamadas `getLogs` por varredura (não martelar o RPC) */
export const MAX_LOG_CALLS = 200;
