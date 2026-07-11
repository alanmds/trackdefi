# Playbook de Expansão — trackdefi

> Fase 7 do plano (10/07/2026, Fable 5). Como adicionar redes e protocolos ao
> trackdefi sem retrabalho. Este documento transforma a expansão em receitas
> mecânicas: um Claude (ou dev) numa sessão futura deve conseguir executá-las
> começando do zero de contexto.

## O princípio (relembrando a regra inviolável)

Todo código específico de protocolo vive atrás da interface `ProtocolAdapter`
(`core/types.ts`): entra um endereço, sai `LpPosition[]` normalizado.
API, preços, UI e validação não conhecem protocolo nenhum — consomem o modelo
normalizado. **Expandir = escrever um adapter novo + registrá-lo.**

### O contrato de comportamento de um adapter (obrigatório)

Todo adapter novo DEVE:

1. Devolver `LpPosition[]` com valores monetários em **BigInt cru** (unidades
   do token); float só existe na borda de exibição.
2. Incluir posições **em stake/depositadas em farms** — é o diferencial do
   produto. Se o protocolo tem gauge/farm, o adapter cobre.
3. Passar todo símbolo de token/pool por `cleanSymbol()` (contratos de
   terceiros são input hostil).
4. Reportar problemas não-fatais via `onWarn` (nunca lançar por pool quebrado;
   pular e avisar).
5. Ser seguro contra **truncamento e paginação**: nenhuma chamada pode perder
   posições silenciosamente (ver a proteção de janela do adapter Aerodrome).
6. NÃO buscar preços — preço é camada separada (`core/prices`), por design
   ("nunca inventar preço" vive num lugar só).
7. Vir com: fixture congelado de carteira real (`--json`), testes unitários de
   mapeamento, e passar na bateria `poc/validate-batch.ts`.

## As costuras mono-protocolo de hoje (tocar ao adicionar o nº 2)

Levantamento exato de onde o código assume "Aerodrome na Base" (10/07/2026):

| Arquivo | O que assume hoje | O que vira |
|---|---|---|
| `core/service.ts` | instancia `AerodromeAdapter` direto; DTO top-level fixa `chain:"base"`, `protocol:"aerodrome"`; um só slug de preço | **registry** de adapters; varre todos com `Promise.allSettled` (falha de um protocolo vira warning, não derruba a resposta); top-level ganha `scopes: [{chain, protocol, scanMs, ok}]`; tokens agrupados por chain para o DefiLlama |
| `core/chain.ts` | um reader fixo da Base; env `BASE_RPC_URLS` | mapa `chainId → reader`; env `RPC_URLS_<CHAIN>` (manter `BASE_RPC_URLS` como sinônimo) |
| `core/adapters/aerodrome/config.ts` | constantes soltas | struct `SugarChainConfig` (ver Receita A) |
| `app/api/positions/route.ts` | nada a mudar no MVP | opcional: `?chains=`/`?protocols=` (default: todos); cache key continua o endereço |
| `app/ui/PositionCard.tsx` + `PositionsView.tsx` | links fixos `basescan.org`; sem badge de rede/protocolo | mapa `chainId → explorer`; badges "Base · Aerodrome" no card (o DTO já carrega `protocol`/`chainId` por posição — previsto desde a Fase 2) |
| `poc/validate-batch.ts` / `validate-live.ts` | carteiras da Base | aceitar escopo por argumento; gabaritos por rede |

Nada disso precisa ser feito antecipadamente — a Receita A inclui essas
mudanças no passo a passo. (Refatorar antes de ter o segundo caso concreto
seria especulação.)

## Receita A — nova REDE do ecossistema Sugar (~1 sessão)

**Descoberta da Fase 7:** o repo `velodrome-finance/sugar` tem deployments em
**12 redes** (conferido em 10/07/2026): base, optimism, celo, fraxtal, ink,
lisk, metall2, mode, soneium, superseed, swell, unichain. O adapter Aerodrome
já fala "Sugar" — parametrizado, ele vira adapter de TODAS elas.
**Velodrome na Optimism é o multi-rede de menor custo que existe para nós.**

Passos:

1. **Endereços**: baixar `deployments/<chain>.env` do repo sugar (raw
   GitHub). Anotar `LP_SUGAR_ADDRESS_<id>`, `V2_FACTORIES`/`CL_FACTORIES`,
   e a carteira `TEST_ADDRESS_<id>` (o repo dá uma de teste por chain!).
   Token de emissões: **VELO na Optimism** (`0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db`
   — CONFIRMAR), AERO só na Base — vira campo de config, sai o hardcode.
2. **Generalizar a config**: transformar `core/adapters/aerodrome/config.ts`
   em `SugarChainConfig { chainId, protocolId, priceSlug, sugar, factories,
   emissionsToken, explorerUrl, rpcs }`. Aerodrome/Base = instância 1;
   Velodrome/OP = instância 2. O `index.ts` do adapter recebe a config no
   construtor (mexer o mínimo na lógica — ela foi validada com contraprova).
3. **Costuras**: aplicar a tabela acima (registry no service, readers por
   chain, badges/explorer na UI).
4. **PoC primeiro** (padrão que deu certo na Fase 1): rodar a CLI na chain
   nova com a carteira de teste do repo ANTES de mexer no site; salvar
   fixture `--json`. Se o struct do Sugar divergir nessa chain, é aqui que
   aparece (a decodificação falha alto — Fase 1 provou que versões variam
   por deployment).
5. **Testes**: duplicar a suíte de mapeamento com o fixture novo (barato).
6. **Bateria**: `validate-batch` na chain nova (a contraprova Q96 funciona
   igual — mesma matemática) + conferência visual em velodrome.finance com
   2+ carteiras reais (garimpar com `find-wallets.ts` apontado para o NFPM
   da chain).
7. **Deploy + validate-live** com gabarito da chain nova.

**Armadilhas conhecidas** (aprendidas nas fases 1–5): versão do contrato
publicado ≠ branch main (sempre validar decodificação ao vivo); grafias de
struct podem variar POR CHAIN; `positionsUnstakedConcentrated` + `positions`
+ dedupe é o padrão seguro em todas; contagem de pools varia (34k na Base —
dimensionar a varredura pela soma das factories, como já fazemos).

## Receita B — novo PROTOCOLO: Uniswap V3 na Base (~2–3 sessões)

Valida o multi-protocolo de verdade (protocolo sem Sugar). ~80% da matemática
já existe (`core/math/liquidity.ts`, testada com contraprova na Fase 5).

1. **Endereços na Base** (CONFIRMAR em docs.uniswap.org/contracts antes de
   usar — mesmo padrão "candidato + confirmação" da Fase 0): factory
   `0x33128a8fC17869897dcE68Ed026d694621f6FDfD`, NFPM
   `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1`.
2. **Enumeração** (barata, sem varrer pools!): `NFPM.balanceOf(owner)` →
   `tokenOfOwnerByIndex` → `positions(tokenId)` em multicall paginado.
3. **Amounts**: `amountsForLiquidity()` nossa + `slot0` do pool
   (`factory.getPool(token0, token1, fee)`). Aqui NOSSA matemática é o
   caminho primário — e ela já está pronta e testada.
4. **Fees pendentes**: truque padrão — simular `collect(tokenId, max, max)`
   com `eth_call` em nome do dono (viem `simulateContract` com
   `account: owner`); devolve os fees sem transação nenhuma (continua 100%
   leitura). Plano B se algum RPC recusar: matemática de `feeGrowthInside`
   (mais difícil — só se necessário).
5. **Staking**: Uniswap V3 não tem gauges (staking é raro/externo) →
   `staked: false` sempre; `emissions` vazio. Range/NFT idênticos ao que a
   UI já exibe.
6. **Contraprova**: nossa matemática é o primário, então a contraprova vira
   a comparação com app.uniswap.org (2+ carteiras, manual) + invariantes da
   bateria.
7. Registry, fixture, testes, badge na UI, deploy, validate-live.

**Modelo recomendado**: passos 3–4 e a validação com **Fable 5** (mesma
lógica das fases 2/5 — matemática financeira sutil); o resto Opus 4.8 executa
bem com este playbook.

## Ordem recomendada rumo às 10 redes

| # | Expansão | Receita | Custo | O que valida |
|---|---|---|---|---|
| 1 | **Velodrome · Optimism** | A | ~1 sessão | multi-REDE + registry/costuras |
| 2 | **Uniswap V3 · Base** | B | 2–3 sessões | multi-PROTOCOLO (maior TVL do mundo) |
| 3 | Uniswap V3 · Ethereum, Arbitrum, Optimism, Polygon | B parametrizada | ~1 sessão/rede | mesmas addresses em quase todas |
| 4 | Demais redes Sugar (Mode, Lisk, …) | A | ~½ sessão/rede | cauda longa conforme demanda |
| 5 | Protocolos líderes por rede (PancakeSwap/BNB…) | B adaptada | caso a caso | conforme tração/pedidos |

Depois de 1+2: **2 redes, 3 protocolos** — e as duas receitas provadas cobrem
o caminho inteiro até o objetivo das 10 redes.

## Definition of done (qualquer expansão)

- [ ] Fixture congelado de carteira real + testes de mapeamento passando
- [ ] Bateria `validate-batch` verde (invariantes + contraprova aplicável)
- [ ] Conferência visual contra o site oficial do protocolo (2+ carteiras)
- [ ] Varredura < 10 s no servidor (medir em produção, não em dev)
- [ ] Badge de rede/protocolo + link de explorer corretos na UI
- [ ] `validate-live` verde após o deploy
- [ ] PLANO_DE_TRABALHO.md e este playbook atualizados com o que se aprendeu

## Riscos que crescem com a escala (monitorar, não resolver já)

- **Cota de RPC** multiplicada por rede → cache por escopo e, se preciso,
  chave paga por chain (`RPC_URLS_<CHAIN>` já previsto).
- **Tempo total** = soma das redes → varrer redes em paralelo no service
  (o `mapLimit` já existe) e considerar resposta parcial progressiva.
- **Tokens sem preço** em redes menores → já tratado ("—", nunca estimar).
- **Versões de contrato divergindo por chain** → o passo "PoC primeiro" de
  cada receita existe exatamente para isso.
