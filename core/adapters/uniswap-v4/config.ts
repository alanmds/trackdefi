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
  enumeration: "index",
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

/**
 * Redes do passo 8 da meta de cobertura total. Endereços da doc OFICIAL
 * (developers.uniswap.org → v4 → deployments) lidos em 28/10/2026 — os
 * endereços NÃO são mais iguais entre redes — e conferidos on-chain em
 * `poc/probe-v4-redes.ts`: `name()` do PositionManager, código de StateView e
 * PoolManager, `getSlot0` de um pool real e o índice da Alchemy devolvendo o
 * NFT mais recente de um dono. Todas enumeram pelo índice (`"index"`), que
 * exige `<REDE>_RPC_URLS` com Alchemy; sem ela o adapter tenta a varredura de
 * `Transfer` e, falhando, avisa na tela.
 */
export const UNISWAP_V4_ETHEREUM: UniV4ChainConfig = {
  chainId: 1,
  positionManager: "0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e",
  stateView: "0x7ffe42c4a5deea5b0fec41c94c136cf115597227",
  poolManager: "0x000000000004444c5dc75cb358380d2e3de08a90",
  enumeration: "index",
};

export const UNISWAP_V4_BASE: UniV4ChainConfig = {
  chainId: 8453,
  positionManager: "0x7c5f5a4bbd8fd63184577525326123b519429bdc",
  stateView: "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71",
  poolManager: "0x498581ff718922c3f8e6a244956af099b2652b2b",
  enumeration: "index",
};

export const UNISWAP_V4_OPTIMISM: UniV4ChainConfig = {
  chainId: 10,
  positionManager: "0x3c3ea4b57a46241e54610e5f022e5c45859a1017",
  stateView: "0xc18a3169788f4f75a170290584eca6395c75ecdb",
  poolManager: "0x9a13f98cb987694c9f086b1f5eb990eea8264ec3",
  enumeration: "index",
};

export const UNISWAP_V4_ARBITRUM: UniV4ChainConfig = {
  chainId: 42161,
  positionManager: "0xd88f38f930b7952f2db2432cb002e7abbf3dd869",
  stateView: "0x76fd297e2d437cd7f76d50f01afe6160f86e9990",
  poolManager: "0x360e68faccca8ca495c1b759fd9eee466db9fb32",
  enumeration: "index",
};

export const UNISWAP_V4_UNICHAIN: UniV4ChainConfig = {
  chainId: 130,
  positionManager: "0x4529a01c7a0410167c5740c487a8de60232617bf",
  stateView: "0x86e8631a016f9068c3f085faf484ee3f5fdee8f2",
  poolManager: "0x1f98400000000000000000000000000000000004",
  enumeration: "index",
};

export const UNISWAP_V4_INK: UniV4ChainConfig = {
  chainId: 57073,
  positionManager: "0x1b35d13a2e2528f192637f14b05f0dc0e7deb566",
  stateView: "0x76fd297e2d437cd7f76d50f01afe6160f86e9990",
  poolManager: "0x360e68faccca8ca495c1b759fd9eee466db9fb32",
  enumeration: "index",
};

export const UNISWAP_V4_SONEIUM: UniV4ChainConfig = {
  chainId: 1868,
  positionManager: "0x1b35d13a2e2528f192637f14b05f0dc0e7deb566",
  stateView: "0x76fd297e2d437cd7f76d50f01afe6160f86e9990",
  poolManager: "0x360e68faccca8ca495c1b759fd9eee466db9fb32",
  enumeration: "index",
};

export const UNISWAP_V4_CELO: UniV4ChainConfig = {
  chainId: 42220,
  positionManager: "0xf7965f3981e4d5bc383bfbcb61501763e9068ca9",
  stateView: "0xbc21f8720babf4b20d195ee5c6e99c52b76f2bfb",
  poolManager: "0x288dc841a52fca2707c6947b3a777c5e56cd87bc",
  enumeration: "index",
};

export const UNISWAP_V4_HYPEREVM: UniV4ChainConfig = {
  chainId: 999,
  positionManager: "0x0d7ab5b3db668128aff6f70c4ebc71d7d4da9bf9",
  stateView: "0x1656326235cb9e34cb58cade53ae30789ab32a1a",
  poolManager: "0x12d4fd9c5dedd00ab8a0bce2cf0167bbf94b6b1f",
  enumeration: "index",
};

/** todas as redes Uniswap v4 ativas (ordem = ordem no registry) */
export const UNISWAP_V4_CHAINS: UniV4ChainConfig[] = [
  UNISWAP_V4_ROBINHOOD,
  UNISWAP_V4_BSC,
  UNISWAP_V4_ETHEREUM,
  UNISWAP_V4_BASE,
  UNISWAP_V4_OPTIMISM,
  UNISWAP_V4_ARBITRUM,
];

/**
 * Configuradas e provadas (poc/probe-v4-redes.ts), mas FORA da lista acima de
 * propósito (28/10/2026): enumeram pelo índice da Alchemy e a Vercel ainda não
 * tem `<REDE>_RPC_URLS` com Alchemy nelas — sem isso cada carteira ganhava um
 * aviso amarelo por rede. Para ligar: pôr a Alchemy na env da rede e mover a
 * constante para `UNISWAP_V4_CHAINS`.
 */
export const UNISWAP_V4_AGUARDANDO_ALCHEMY: UniV4ChainConfig[] = [
  UNISWAP_V4_UNICHAIN,
  UNISWAP_V4_INK,
  UNISWAP_V4_SONEIUM,
  UNISWAP_V4_CELO,
  UNISWAP_V4_HYPEREVM,
];

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
