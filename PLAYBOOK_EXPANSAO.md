# Playbook de Melhorias — trackdefi (v2)

> v1 (Fase 7, 10/07/2026) era o playbook de *expansão de cobertura*.
> **v2 (14/07/2026):** revisado com o core dado por COMPLETO — daqui em diante
> tudo é melhoria incremental, priorizada por custo-benefício. Inclui a
> Receita C (APR) com os achados honestos do PoC de 14/07/2026 e a Receita D
> (Uniswap v4) com avaliação técnica realista.

## O que "core completo" significa

No ar e validado: 4 redes (Base, Optimism, Ethereum, Arbitrum) · 3 protocolos
(Aerodrome, Velodrome, Uniswap v3) · posições clássicas + concentradas +
em stake com emissões · preços multi-rede · API com cache/limites · UI
completa · 68 testes · bateria com contraprova matemática · roadmap público ·
SEO técnico durável. Nenhuma melhoria abaixo exige mudar essa fundação — a
interface `ProtocolAdapter` e o registry absorvem tudo.

## Princípios (imutáveis, valem para toda melhoria)

1. **PoC primeiro**: sonda em `poc/` prova a viabilidade ANTES de tocar no
   site. Endereços/APIs confirmados em fonte oficial, nunca de memória.
2. **Número honesto ou "—"**: nunca exibir valor que pode estar errado.
   Dado ambíguo, ausente ou suspeito → travessão.
3. Todo adapter novo cumpre o contrato de comportamento (BigInt cru, staked
   incluído, `cleanSymbol`, `onWarn`, paginação sem perda silenciosa,
   fixture + testes + bateria).
4. Publicar (`git push`) só com aprovação do Alan; antes: typecheck + testes
   + build; depois: `validate-live`.
5. Conteúdo público novo (páginas/textos) também passa pela aprovação do Alan.

## Priorização por custo-benefício (14/07/2026)

| # | Melhoria | Receita | Custo | Benefício | Depende de |
|---|---|---|---|---|---|
| 1 | **APR & idade dos pools** | C | 1–2 sessões | ALTO — o nº que todo LP olha primeiro; beneficia 100% dos usuários já | nada |
| 2 | **Uniswap v4** | D | 2–4 sessões | MÉDIO-ALTO e crescendo com a migração de TVL p/ v4 | melhor após C |
| 3 | Domínio definitivo + checklist SEO.md | — | baixo (ação do Alan) | ALTO — destrava ranking e monetização | decisão do Alan |
| 4 | Monetização técnica (tip jar, /support, slots, widget LI.FI) | ebook | baixo por item | receita | domínio (maioria) |
| 5 | Superchain: +redes Velodrome (Mode, Ink, Unichain, Soneium, Fraxtal; depois cauda) | A | ~½ sessão/rede | BAIXO-MÉDIO — TVLs pequenos; soma à narrativa "10 redes" | nada |
| 6 | Alertas de fora-da-faixa | E (esboço) | médio-alto | ALTO — âncora do futuro "Pro" | infra de notificação |
| 7 | PnL pessoal + perda impermanente | F (esboço) | ALTO (indexador) | ALTO — diferencial do revert.finance | indexador |

**Ordem recomendada: 1 → 2**, com 3 e 4 correndo em paralelo quando o Alan
decidir o domínio. 5 entra como "encaixe" quando sobrar meia sessão. 6 e 7
esperam tração/monetização.

---

## Receita A — nova rede do ecossistema Sugar (PROVADA)

Provada na Velodrome/Optimism em 1 sessão (13/07/2026). Adapter é o mesmo;
muda só a `SugarChainConfig` (config.ts) + rede em `core/chains.ts`.

1. `deployments/<chain>.env` do repo velodrome-finance/sugar → endereços +
   carteira de teste.
2. Instância de `SugarChainConfig` (emissionsToken VERIFICADO on-chain via
   `symbol()`) + entrada em `chains.ts` + registro no registry.
3. PoC (`poc/probe-velodrome.ts` como modelo) ANTES de tocar no site.
4. Textos/SEO/roadmap + bateria + validate-live.

Redes restantes (12 no repo, 2 cobertas): prioridade Mode, Ink, Unichain,
Soneium, Fraxtal; cauda Lisk, Swell, Metal L2, Superseed, Celo.
Armadilhas conhecidas: struct/versão do Sugar pode variar POR CHAIN (o PoC
pega); grafias de símbolo idem.

## Receita B — Uniswap v3 em rede nova (PROVADA)

Provada em ETH/ARB/OP numa fração de sessão (13/07/2026): instância de
`UniV3ChainConfig` + rede em `chains.ts`. ETH/ARB/OP usam endereços
canônicos; a Base difere — SEMPRE confirmar na doc oficial (ela mesma avisa
para não assumir). PoC de coerência: `NFPM.factory() == factory` da config
(`poc/probe-uniswap-chains.ts`). getLogs no mainnet limita faixa de blocos —
sonda usa faixas decrescentes.

## Receita C — APR & idade dos pools (APR IMPLEMENTADO 17/07/2026)

**Objetivo:** em cada card: APR atual (taxas + emissões separadas), média de
30 dias e idade do pool. **Fora do escopo (honesto):** média exata "desde a
gênese" para Aerodrome/Velodrome e PnL pessoal (→ Receita F).

**STATUS:** parte APR ENTREGUE e no ar (`core/yields/defillama.ts`, DTO `apr`,
UI). Idade do pool ainda pendente (ver seção abaixo).

### O que o PoC provou (poc/probe-yields.ts e probe-yields2.ts)

- **Fonte:** `yields.llama.fi/pools` (grátis, sem chave; ~15.400 pools;
  payload >10 MB → baixar no servidor, no máx. 1×/hora, e indexar).
- **Cobertura REAL (recontada 17/07/2026):** Aerodrome/Base ✓ (415 pools),
  Velodrome/OP ✓ (110), Uniswap v3 Ethereum ✓ (558) + Arbitrum ✓ (206).
  CORREÇÃO do achado de 14/07: a Velodrome NÃO era lacuna — no dataset a
  Optimism se chama **"OP Mainnet"**, não "Optimism"; o casamento usava o
  label errado. Agora `chains.yieldsLabel` resolve. **LACUNA REAL que
  sobra:** a DefiLlama não indexa **Uniswap v3 na Base nem na OP** (só tem v2
  e v4 lá) → esses pools mostram "—" honesto até fazermos o cálculo próprio
  (feeGrowth + gauge; follow-up ~1 sessão). Base do Aerodrome (o DEX
  dominante da rede) está coberta.
- **Campos úteis:** `apy`, `apyBase` (taxas), `apyReward` (emissões),
  `apyMean30d` (média 30d REAL), `count` (dias de dados), `tvlUsd`,
  `poolMeta` (ex.: "CL100 - 0.0217%"), `underlyingTokens`, `rewardTokens`.
  `apyBaseInception` (desde a criação) na prática só vem para Uniswap;
  na Aerodrome veio **null**.
- **O risco central — casamento ambíguo:** o dataset NÃO traz o endereço do
  pool (só ID interno). Casa-se por `chain + project + par de tokens +
  poolMeta/tick spacing`. Medido: WETH/USDC na Base = **9 candidatos**;
  USDC/cbBTC = 8; pools de TVL ínfimo exibem APRs absurdos (ex.: 28.350%).
  Casar errado = mostrar número ridículo → viola o princípio nº 2.

### Política adotada (aprovação implícita do princípio "honesto ou —")

- Desambiguar por: rede + protocolo (slug map: aerodrome-slipstream/v1,
  uniswap-v3) + conjunto de tokens + tick spacing extraído do `poolMeta`;
  entre os que sobrarem, o de **maior TVL**.
- Mostrar "—" quando: sem candidato · empate não resolvido (dominância < 10x)
  · `tvlUsd` abaixo de um piso (US$ 10 mil) · APR acima do teto de sanidade
  (1.000% a.a.) · **Uniswap v3 na Base/OP** (lacuna real do dataset).
- Rotular a fonte no card: "APR · DefiLlama" (dado de terceiro, transparência).
- **Follow-up opcional (+1 sessão):** APR de emissões da Aerodrome/Velodrome
  calculado por NÓS via Sugar (`emissions` × preço ÷ TVL em stake) — fecha a
  lacuna da Velodrome e dá contraprova do `apyReward` da DefiLlama.

### Idade do pool (independente da DefiLlama)

- Aerodrome/Velodrome: campo `created_at` do struct Lp do Sugar — exige a
  ABI EXATA do contrato publicado (pendência conhecida desde a Fase 1;
  baixar do BaseScan/OP Etherscan, contrato verificado).
- Uniswap: evento `PoolCreated` da factory (1 getLogs por pool, cachear).

### Passos de execução (1–2 sessões)

1. `core/yields/defillama.ts`: download + índice em memória com TTL de 1 h
   (chave: `chainId|project|token0|token1|spacing`), matching puro e testável.
2. Fixture congelado com os 9 candidatos reais de WETH/USDC → testes da
   desambiguação (maior TVL, piso, teto, empate → "—").
3. DTO: `apr { current, base, reward, mean30d, source } | null` e
   `poolCreatedAt | null` por posição; totais NÃO mudam.
4. UI: linha discreta no card (APR à direita do símbolo; idade no rodapé do
   card); tooltip com base/reward/média.
5. `validate-batch`: checagens de sanidade (APR ≤ teto, casamento estável).
6. Aprovação do Alan (muda conteúdo público) → deploy → validate-live.

## Receita C2 — APR da posição, "rendendo agora" (COMPLETA 19/07/2026)

**Motivação (Alan, 19/07/2026):** o APR do pool sozinho não apoia decisão de
rebalanceamento/lucratividade. O número que importa é o da POSIÇÃO: fora do
range, o rendimento corrente é **0%** (sem taxas novas; em stake
Aerodrome/Velodrome as emissões também pausam) — e nem o revert.finance
acerta isso. "Total APR desde a entrada" (PnL) continua sendo a Receita F.

**STATUS: Fases 0–3 ENTREGUES** (aguardando aprovação do Alan p/ push).
Motor puro `core/yields/positionApr.ts`; DTO `earning { nowPct, feePct,
emissionPct } | null`; insumos on-chain em `LpPosition.earningInputs`;
UI "Earning now X%" com breakdown e o APR do pool como referência.

- **Fase 0 (UI honesta com `range.inRange`)** — substituída pela Fase 3
  (agora data-driven via DTO `earning`).
- **Fase 1 — emissões pessoais (PoC `poc/probe-emissions.ts`):** PROVADO.
  `emissionAPR = rewardRate_gauge × (L_staked_pos / pool.stakedLiquidity) ×
  ANO × preço ÷ valor`. ABI confirmada no contrato publicado: `pool.gauge()`,
  `pool.stakedLiquidity()`, `pool.liquidity()`, `gauge.rewardRate()`,
  `gauge.earned(account,tokenId)`. Medido 8.91% single-shot vs 12.38%
  realizado (contraprova por delta de `earned`); pool CL1 (1 tick) tem
  liquidez ativa MUITO volátil → o número single-shot oscila 5–13% entre
  leituras, honesto como estimativa instantânea. **apyReward da DefiLlama é
  LIXO nesses pools (6012% medido)** → cálculo on-chain é obrigatório.
- **Fase 2 — fee APR corrente (PoC `poc/probe-fee-apr.ts`):** PROVADO.
  Simplificação-chave: como `volume×fee == apyBase×TVL/365` (coerência interna
  medida EXATA), usa-se o apyBase+TVL que o `match()` já devolve, sem plumbar
  volumeUsd1d/feeTier: `feeAPR = apyBase × (L_pos/L_ativa) × (TVL/valor)`.
  Multiplicador de concentração medido ×1.0 a ×3.5 em posições reais; bate com
  o revert.finance (WETH/USDC 0.05% ETH ~45% nos dois). **Descoberta:** posição
  CL em stake na Aerodrome acumula TAXAS **e** emissões (medido) → somar.
- **Fase 3 — produção:** `computeEarning` puro (12 testes com números do PoC);
  adapters coletam L da posição + `pool.liquidity()`/`stakedLiquidity()` +
  `gauge.rewardRate()` numa multicall ISOLADA (falha só apaga o APR, nunca
  derruba a posição); service combina com preços; UI mostra "Earning now".
  Verificação: typecheck + 95 testes + build + validate-batch (com guarda de
  earning) + render ao vivo nas carteiras 0x0596 (emissões) e 0x8cad (fees).

**Fora do escopo (segue como Receita F):** "total APR desde a entrada" com PnL
e perda impermanente — precisa de indexador.

**Achados de 19/07/2026:**
- A DefiLlama passou a indexar **Uniswap v3 na Base** (fee APR visto ao vivo);
  a "lacuna real" de 17/07 fechou; OP a conferir.
- `/poolsOld` (endereço do pool) agora exige plano PAGO.
- O dataset tem linhas DUPLICADAS mortas do MESMO pool CL (CL200-WETH/VELO na
  OP: gêmeo de APY 0 e TVL menor anula a dominância). Dedupe do apyReward do
  pool: patch validado em 19/07 (86 testes) foi REVERTIDO a pedido do Alan —
  retomar quando ele quiser mexer no APR do pool.
- **Bug de infra corrigido:** o vitest rodava cópias de `.claude/worktrees/`
  (inflava a contagem de testes) — exclude ajustado no vitest.config.ts.

## Receita D — Uniswap v4 (avaliação honesta)

**Quando fazer:** após a Receita C. Gatilho objetivo: usuários com posições
v4 aparecendo (pedidos/warnings) ou TVL da v4 relevante frente à v3 nas
nossas redes. O benefício cresce com a migração; o custo não diminui
esperando — mas o C beneficia todo mundo JÁ.

**O que reusa (barato):** TickMath/Q96 (`core/math/` prontos e testados),
enumeração por NFT (padrão similar), registry/UI/DTO (zero mudança),
Receita B como molde de processo.

**O que é genuinamente novo/difícil (por ordem de risco):**
1. **Leitura de estado**: v4 é um singleton (`PoolManager`) — posições vivem
   no `PositionManager` (ERC-721) e o estado do pool é lido via contrato
   `StateView` (padrão novo de leitura; PoC dedicado).
2. **Taxas pendentes**: NÃO existe `collect()` simulável como na v3. Caminho:
   matemática de `feeGrowthInside` (determinística, nosso estilo, mas mais
   código + testes com vetores reais).
3. **Hooks**: cada pool pode ter lógica própria de taxa. Política honesta:
   pool com hook não-padrão → fees "—" (e badge "hooked pool"), amounts
   sempre corretos (não dependem do hook).

**Fases:** PoC de leitura (1 sessão) → motor amounts+fees (1–2) → validação/
UI/deploy (1). Endereços por rede: confirmar SEMPRE na doc oficial
(developers.uniswap.org), como na Receita B.

## Receita E — alertas de fora-da-faixa (esboço)

Âncora do futuro "Pro" (ebook, cap. 7). Exige: guardar inscrições (carteira +
canal), verificador agendado (cron da Vercel), canal de entrega (e-mail via
Resend ou Telegram bot). Decisões de produto antes de codar: canal, limites
do grátis, privacidade (armazenar endereço = primeira base de dados nossa).

## Receita F — PnL pessoal + perda impermanente (esboço)

O grande diferencial do revert.finance. Exige INDEXADOR (histórico de
eventos por posição: depósitos, retiradas, coletas, preços na época).
Caminhos: subgraph próprio · Envio/Ponder self-hosted · APIs históricas
pagas. É o maior projeto pós-core (≥ 2 semanas de sessões) — só iniciar com
tração comprovada e, idealmente, monetização cobrindo custos de infra.

## Definition of done (qualquer melhoria)

- [ ] PoC em `poc/` provou a premissa antes do código de produção
- [ ] Fixture + testes das decisões sutis (desambiguação, sanidade, bordas)
- [ ] Bateria `validate-batch` verde; typecheck + testes + build verdes
- [ ] Conteúdo público aprovado pelo Alan antes do push
- [ ] `validate-live` verde pós-deploy
- [ ] PLANO_DE_TRABALHO.md e este playbook atualizados com o aprendido
