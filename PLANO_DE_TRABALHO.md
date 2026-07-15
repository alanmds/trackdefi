# trackdefi — Plano de Trabalho

> Criado em 10/07/2026 com Claude (Fable 5). Este arquivo é a fonte de verdade do
> projeto entre sessões. Atualizar ao fim de cada fase.

## Decisões do Alan (10/07/2026)
- Plano aprovado.
- Nome do projeto: **trackdefi**.
- Idioma do site: **inglês** (PT depois).

## Visão do produto

Site público e profissional: o usuário cola **apenas o endereço da carteira**
(sem login, sem conectar carteira, sem chave privada) e vê todas as suas
posições em pools de liquidez.

- **Escopo inicial (validação do modelo):** rede **Base** + protocolo **Aerodrome**.
- **Longo prazo:** as 10 maiores redes e os principais DEXs de cada uma.
- **Referências de mercado:** revert.finance (forte em PnL histórico de posições
  Uniswap) e app.metrix.finance (forte em simulação/planejamento de posições).
- **Diferencial do MVP:** cobertura completa da Aerodrome, incluindo posições
  **em stake nos gauges** — que não aparecem na carteira como tokens e que
  rastreadores genéricos costumam perder.

## Regra anti-retrabalho (inviolável)

Todo código específico de protocolo vive atrás de uma interface única
`ProtocolAdapter` (entrada: endereço; saída: lista de `Position` normalizada).
Rede/protocolo novo = escrever um adapter novo. Interface, API, preços e site
não mudam. (Mesmo padrão do `ler_extrato()` multi-banco do Meus Gastos.)

## MVP — o que o usuário vê

Por posição: par de tokens, tipo (clássico volátil/estável ou concentrado),
quantidade de cada token, valor em US$, taxas + emissões AERO a receber,
em stake ou não, e para posições concentradas o status **na faixa / fora da
faixa** com a faixa de preços. Totais no topo: valor total em pools + total a
receber. Estados tratados: endereço inválido, carteira sem posições, erro de rede.

**Fora do MVP (de propósito, decidir depois):** PnL histórico e perda
impermanente desde a entrada (exige indexador de eventos — é o grande
diferencial do revert.finance, mas ~10× o esforço; candidato a fase futura),
simulador de APR (nicho do metrix), alertas, outros protocolos/redes.

## Arquitetura

| Camada | Escolha | Por quê |
|---|---|---|
| Dados on-chain | Contrato **LP Sugar v3** da Aerodrome, via **viem** (TypeScript) | API on-chain oficial do protocolo; `positions(limit, offset, account)` retorna clássico + concentrado + staked + fees + emissões, paginado. Sem indexador próprio. |
| RPC | Alchemy ou QuickNode (free tier) + fallback RPC público da Base | Chave fica no servidor, nunca no navegador |
| Preços US$ | DefiLlama (`coins.llama.fi`, grátis, sem chave) | Cobre Base; fallback: mostrar "—" e nunca inventar preço |
| Backend | Rota API do Next.js `/api/positions?address=0x...` com cache ~60 s | Esconde a chave RPC, permite cache compartilhado e rate-limit |
| Frontend | **Next.js + TypeScript** + TanStack Query | Padrão da indústria, deploy grátis na Vercel |
| Deploy | Vercel (grátis) + domínio próprio (~US$ 10/ano, opcional no início) | Zero custo fixo para validar |

Estrutura de pastas prevista:

```
core/           # motor puro, testável sem interface (como o motor.py)
  types.ts      # Position, Pool, interface ProtocolAdapter
  adapters/aerodrome/
  prices/
app/            # site Next.js (páginas + /api/positions)
tests/          # fixtures congelados de carteiras reais + testes unitários
```

## Referências técnicas (verificar na Fase 1)

- Repositório Sugar: https://github.com/velodrome-finance/sugar — endereço
  vigente do LP Sugar na Base está em `deployments/base.env` do repo.
  CONFIRMADO em 10/07/2026 (branch main): `LP_SUGAR_ADDRESS_8453 =
  0x69dD9db6d8f8E7d83887A704f447b1a584b599A1`. Outros úteis do mesmo env:
  V2 factory `0x420DD381b31aEf6683db6B902084cB0FFECe40Da`, 3 CL factories,
  carteira de teste do próprio repo `0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac`.
- Struct `Position` (ordem exata, 10/07/2026): id, lp, liquidity, staked,
  amount0, amount1, staked0, staked1, unstaked_earned0, unstaked_earned1,
  emissions_earned, tick_lower, tick_upper, sqrt_ratio_lower,
  sqrt_ratio_upper, locker (address), unlocks_at (uint32), alm (address).
- Cobertura na Base: chamar `positions()` E `positionsUnstakedConcentrated()`
  e deduplicar por (lp, id) — o README diz que a segunda é necessária em
  deployments pré-Superchain; na dúvida, chamamos as duas.
- `Lp.type`: -1 = v2 estável, 0 = v2 volátil, >0 = tick spacing (concentrada).
- Slipstream (liquidez concentrada, fork do Uniswap V3):
  https://github.com/aerodrome-finance/slipstream
- Sugar tem VERSÕES — endereço muda quando atualizam. Deixar configurável.

## Fases

### Fase 0 — Preparação (1 sessão) — Opus 4.8 suficiente
Instalar Node.js LTS e Git; criar contas GitHub, Vercel e Alchemy (todas grátis);
decidir nome provisório e idioma do site (recomendação: EN primeiro — público
global — com PT em seguida). `git init` no projeto desde o dia 1.
**Critério de saída:** `node --version` funciona; repositório criado.

### Fase 1 — Prova de conceito (1–2 sessões) — **Fable 5**
Script de terminal: recebe um endereço, chama o Sugar via viem e imprime as
posições. Validar com carteira real ativa na Aerodrome comparando com o
próprio site aerodrome.finance.
**Critério de saída:** números batem com a Aerodrome (quantidades e recompensas).
Por que Fable 5: aqui se fixam as decisões de fundação (versão/endereço do
Sugar, decodificação dos structs, BigInt) — erro aqui contamina tudo.

### Fase 2 — Motor / core (2–3 sessões) — **Fable 5**
Adapter Aerodrome completo e testado: normalização de decimais (USDC=6,
WETH=18…), matemática de liquidez concentrada (sqrtPriceX96, ticks, Q96),
status na faixa, preços US$, interface `ProtocolAdapter` genérica. Testes
unitários com fixtures congelados de respostas reais.
Por que Fable 5: é onde moram os bugs sutis de matemática que fazem o site
mostrar valores errados — o pior erro possível num produto financeiro.

### Fase 3 — API (1 sessão) — Opus 4.8 suficiente (revisão final: Fable 5)
`/api/positions` com validação de endereço, cache, timeout, mensagens de erro
limpas e rate limiting básico.

### Fase 4 — Interface (2–3 sessões) — Opus 4.8 suficiente
Landing com campo de busca; página de resultados (cards/tabela, totais,
distintivo na faixa/fora da faixa); responsivo; modo claro/escuro; disclaimers.
Suporte a Basenames/ENS (nome → endereço) é barato e pode entrar aqui.

### Fase 5 — Validação e endurecimento (1–2 sessões) — **Fable 5**
Bateria de carteiras reais (grande, vazia, só staked, só concentrada, token sem
preço), comparação com Aerodrome/DeBank, revisão de segurança da API
(injeção, abuso), tratamento de RPC fora do ar.
**Critério de saída:** 5+ carteiras reais conferidas sem divergência.

### Fase 6 — Publicação (1 sessão) — Opus 4.8 suficiente
Deploy na Vercel, domínio, analytics sem cookies (Plausible/Umami), página
"como funciona / por que é seguro" (só leitura pública, nunca pedimos chaves),
disclaimer "não é aconselhamento financeiro".

### Fase 7 — Playbook de expansão (1 sessão) — Fable 5 desenha, Opus executa
Checklist de "como adicionar protocolo/rede nº 2" usando o adapter. Candidato
natural: Uniswap V3 na própria Base (reaproveita ~80% da matemática da Fase 2
e valida o multi-protocolo antes do multi-rede).

**Total estimado: ~9–13 sessões de trabalho até o site no ar.**

## Riscos mapeados

1. Endereço/versão do Sugar muda → configurável + teste que detecta quebra.
2. Carteira com muitas posições → paginação desde o dia 1.
3. Token sem preço na API → mostrar "—", nunca estimar silenciosamente.
4. Limite do RPC grátis → cache de 60 s; trocar de tier só se houver tráfego.
5. Confiança do usuário → nunca pedir chave/seed; deixar isso estampado no site.
6. Precisão numérica → BigInt em todo o core; float só na formatação final.

## Preferências do Alan (herdadas do Meus Gastos)
Direto ao ponto, números antes de opinião, precisão acima de velocidade,
testar antes de entregar, não expandir escopo sem perguntar.

## Status
- [x] Plano aprovado (10/07/2026)
- [x] Fase 0 — Node v24.16, npm 11, Git 2.55 já instalados; `git init` feito.
      Pendências não bloqueantes: contas GitHub/Vercel (necessárias só na
      Fase 6) e Alchemy (só se o RPC público limitar).
- [x] Fase 1 — PoC FUNCIONANDO em 10/07/2026 (`npm run poc -- <endereco>`).
      Carteira de teste: 7 posições (clássicas staked/não-staked + 2
      concentradas), US$ 438,03 em pools + US$ 341,58 a receber, faixa
      na/fora ok. Fixture salvo em `poc/fixture-0x892Ff98a.json`.
      VALIDADA pelo Alan em 10/07/2026: carteira 0x05963CdC conferida contra
      o site da Aerodrome — posições, quantidades e recompensas AERO batem.
- [x] Fase 2 — motor/core CONCLUÍDO em 10/07/2026:
      `core/` (types + ProtocolAdapter, math/ticks, prices/defillama,
      adapters/aerodrome) com 18 testes unitários (`npm test`) usando
      fixtures reais + `npm run typecheck` limpo. A CLI `npm run poc` virou
      casca fina sobre o core. Regressão ao vivo nas 2 carteiras: idêntica.
      Achados da Fase 1 RESOLVIDOS: (1) byAddress abandonado — metadados
      lidos direto do pool (imune a versão do Sugar); (2) varredura paralela
      (8 janelas) 78 s → 14 s no RPC público; positionsUnstakedConcentrated
      pagina por NFT da conta (barato); proteção contra truncamento de 200
      posições/chamada (janela cheia é re-varrida em metades, com teste).
- [x] Fase 3 — API CONCLUÍDA em 10/07/2026 (Opus 4.8). App Next.js 16
      (App Router) + rota `GET /api/positions?address=0x...`:
      `core/service.ts` (buildResponse puro + getWalletPositions) monta o DTO
      com US$ já calculado no servidor e zero bigint no JSON; `core/guards.ts`
      (TtlCache 60s + FixedWindowLimiter 30/min por IP, relógio injetável);
      `core/chain.ts` (RPC por env BASE_RPC_URLS, senão públicos). Rota =
      casca fina: valida (400), rate-limit (429), cache (x-cache HIT/MISS),
      timeout 50s (504), upstream (502). 12 testes novos (service+guards,
      total 30) + `npm run check-api` bate na chain real: 200/HIT/400 ok,
      MISS ~12–16 s, HIT 0 ms. `npm run build` verde (rota = ƒ dynamic).
      DECISÃO RPC: seguimos no público por ora (funciona); Alchemy é drop-in
      por env quando quisermos ~2–5 s. Ver risco Vercel abaixo.
- [x] Fase 4 — Interface CONCLUÍDA em 10/07/2026 (Fable 5). Landing
      (busca com validação + demo wallet + trust/como funciona) e página
      `/w/<endereco>` (KPIs, cards com badges de status ícone+texto, barra
      de faixa com marcador, claimables, estados de loading com cronômetro/
      erro/vazio). Identidade: fundo NavajoWhite #FFDEAD (pedido do Alan),
      cartões #FFFDF6, tinta #2E2013, bronze #7A4A10, status
      verde/âmbar/vermelho VALIDADOS pelo script dataviz nas 2 superfícies;
      fontes Fraunces (títulos) + Inter (UI, números tabulares).
      Verificação visual via painel de preview (desktop + mobile) com dados
      reais congelados; produção testada ao vivo: 200 OK em 14,9 s.
- [x] Fase 5 — Validação e endurecimento CONCLUÍDA em 10/07/2026 (Fable 5).
      BATERIA: 6 carteiras reais (a do Alan, demo, robô de 1.160 mints/100min
      que terminou vazio, média, pequena e a lixeira 0x…0001 com 27.786
      posições de spam) — TODAS passaram nas invariantes do DTO e na
      CONTRAPROVA INDEPENDENTE: `core/math/liquidity.ts` (Q96/BigInt, port de
      getAmountsForLiquidity) recalcula amounts das concentradas a partir de
      liquidity+slot0 lido direto do pool e bate com o Sugar (tolerância 1%).
      ENDURECIMENTOS: cleanSymbol (símbolos de contratos de terceiros:
      remove controle/invisíveis/RTL, limita tamanho); Semaphore de 4
      varreduras simultâneas por instância (503 busy + retry-after); fixture
      ignorado na Vercel; resposta CORTADA nas top 200 posições por valor
      (totais sobre todas + totalPositions no DTO + aviso na UI — carteiras
      -lixeira existem!); avisos de varredura visíveis na UI; RPC 100% fora
      do ar → 502 limpo em ~1 s (poc/check-outage.ts). 44 testes.
      Scripts permanentes: poc/find-wallets.ts (garimpa carteiras ativas) e
      poc/validate-batch.ts (bateria completa — rodar antes de cada release).
- [x] Fase 6 — Publicação CONCLUÍDA em 10/07/2026. **SITE NO AR:
      https://trackdefi.vercel.app** (repo: github.com/alanmds/trackdefi;
      push → redeploy automático). Validação de produção
      (poc/validate-live.ts): 14/14 checks — scan no servidor da Vercel em
      ~4–5 s (3× mais rápido que local; latência de datacenter), cache HIT
      164 ms, fixture desligado, posições-gabarito presentes, invariantes ok,
      headers de segurança e robots.txt conferidos no domínio público.
      Pendências OPCIONAIS do Alan no painel Vercel (DEPLOY.md Parte 3):
      ligar Analytics (1 clique) e BASE_RPC_URLS da Alchemy (nem parece
      necessário — 4 s já está ótimo). Domínio próprio: decidir após validar
      com usuários.
      Histórico da preparação: CÓDIGO PRONTO em 10/07/2026 (Opus 4.8), aguardando
      passos de conta do Alan (só ele pode: criar GitHub/Vercel, deploy).
      Preparado e testado: página /how-it-works (confiança/segurança + "não é
      aconselhamento"), headers de segurança em next.config (X-Frame DENY,
      nosniff, HSTS, Referrer-Policy, Permissions-Policy, CSP frame-ancestors;
      X-Powered-By removido — todos conferidos na resposta HTTP), OG/Twitter
      meta, Vercel Analytics (sem cookies) no layout, robots.txt (bloqueia
      /w/ e /api/), README.md e DEPLOY.md (passo a passo em PT). Build verde
      com as novas rotas; 44 testes ok.
      Passos do Alan em DEPLOY.md: (1) GitHub → me manda a URL do repo, eu dou
      push; (2) Vercel import (auto-detecta Next); (3) opcional BASE_RPC_URLS
      (Alchemy) + ligar Analytics. Domínio grátis .vercel.app primeiro
      (decisão do Alan). Após deploy: rodar validate-batch contra a URL real.
      NOTA npm audit: 2 moderadas em postcss DENTRO da árvore do Next (build-
      time, não exposto); "fix" rebaixaria Next p/ v9 → NÃO rodar --force.
      LIMITAÇÃO: carteira-lixeira (27k) > timeout → 504 honesto; RPC dedicado
      mitiga.
- [x] Fase 7 — Playbook de expansão CONCLUÍDA em 10/07/2026 (Fable 5).
      Entregável: **PLAYBOOK_EXPANSAO.md** — contrato de comportamento de um
      adapter, levantamento das costuras mono-protocolo (tabela arquivo a
      arquivo), Receita A (nova rede do ecossistema Sugar, ~1 sessão) e
      Receita B (Uniswap V3 na Base, 2–3 sessões, fees via collect simulado),
      ordem recomendada e definition of done por expansão.
      DESCOBERTA-CHAVE: o Sugar existe em 12 REDES (optimism, celo, fraxtal,
      ink, lisk, metall2, mode, soneium, superseed, swell, unichain + base) →
      o adapter atual parametrizado cobre Velodrome/Optimism quase de graça;
      multi-rede é MAIS BARATO que multi-protocolo. Ordem: (1) Velodrome/OP,
      (2) Uniswap V3/Base, (3) Uniswap nas redes grandes, (4) cauda Sugar.

═══ PLANO ORIGINAL 100% CONCLUÍDO (fases 0–7) em 10/07/2026 ═══
Próximos passos são as expansões do PLAYBOOK_EXPANSAO.md, priorizadas pelo
feedback de usuários do site no ar (https://trackdefi.vercel.app).

## Expansões executadas

- [x] **Playbook v2 — reestruturação por custo-benefício** (14/07/2026,
      Fable 5, a pedido do Alan). Core declarado COMPLETO; tudo agora é
      melhoria. PLAYBOOK_EXPANSAO.md reescrito com tabela de priorização
      (1º APR/Receita C, 2º Uniswap v4/Receita D, Superchain rebaixada a
      encaixe) e receitas novas C–F. PoC do APR (poc/probe-yields*.ts):
      DefiLlama cobre Uniswap (769 pools) e Aerodrome (416), mas
      **Velodrome/OP = 0**; casamento é por tokens+tick spacing (sem
      endereço no dataset; WETH/USDC = 9 candidatos; TVL ínfimo mostra APR
      absurdo) → política "número honesto ou —" com maior-TVL + pisos/tetos.
      apyBaseInception só na Uniswap; média 30d (apyMean30d) disponível.
      Idade do pool: created_at do Sugar (precisa ABI publicada — pendência
      antiga) + PoolCreated na Uniswap. Implementação da Receita C: PRÓXIMA.

- [x] **Receita B multi-rede — Uniswap v3 em Ethereum, Arbitrum e Optimism**
      (13/07/2026, Fable 5). Endereços CONFIRMADOS na doc oficial: ETH/ARB/OP
      usam as canônicas (factory 0x1F98…F984, NFPM 0xC364…FE88); só a Base
      difere — a própria doc manda não assumir. `UniV3ChainConfig` +
      instâncias; chains.ts ganhou Ethereum (1) e Arbitrum (42161) com envs
      ETHEREUM_RPC_URLS/ARBITRUM_RPC_URLS; registry = 6 adapters em 4 redes
      (readers compartilhados por rede). PoC (poc/probe-uniswap-chains.ts):
      coerência NFPM.factory()==factory nas 3 redes + carteiras reais (ETH:
      baleia de 386 posições em 17,6 s no RPC grátis; ARB/OP: 1 posição
      cada, ~1–2 s); getLogs do mainnet limita faixa de blocos → sonda tenta
      1500/300/50. UI/SEO/roadmap: 4 redes (Uniswap multi-rede → Live;
      Next = Superchain). 68 testes. Ao vivo: carteira de teste, 4 redes em
      13 s, totais estáveis.

- [x] **Receita A — Velodrome na Optimism** (13/07/2026, Fable 5). PRIMEIRA
      REDE NOVA. PoC-primeiro (poc/probe-velodrome.ts): VELO
      0x9560…88Db VERIFICADO on-chain (symbol()="VELO"); Sugar da OP
      (0x3475…74aA, deployments/optimism.env) decodifica com o MESMO struct;
      5 posições reais da carteira de teste em 1,4 s; fixture salvo.
      Generalização: `SugarChainConfig` (config.ts) — Aerodrome/Base e
      Velodrome/OP são instâncias do MESMO adapter; `core/chains.ts` (rede →
      slug DefiLlama/explorer/RPCs/env) + `createReader(chainId)`;
      registry monta 3 adapters em 2 redes; service agrega com preços POR
      REDE (chave chainId:endereço — WETH tem o MESMO endereço 0x4200…0006
      na Base E na OP, colisão real evitada); DTO: chain→chains[];
      getWalletPositions(address) cria os readers sozinho. UI: badge de rede
      + explorer por chain nos cards; textos/SEO/roadmap atualizados
      (Velodrome → Live; Next = Uniswap v3 multi-rede).
      65 testes (5 novos). Ao vivo: carteira de teste com 12 posições em
      2 REDES (7 Base + 5 OP) agregadas em 11,6 s, emissões VELO
      precificadas, ALM na OP etiquetado; regressão da carteira-gabarito
      com contraprova Q96 verde. PENDENTE menor: parametrizar validate-batch
      por chain (a contraprova é a mesma; PoC+invariantes cobriram a OP).
      OPCIONAL pós-deploy: env OPTIMISM_RPC_URLS na Vercel p/ RPC pago da OP.

- [x] **SEO durável** (12/07/2026, Fable 5, aprovado pelo Alan). Regra do
      Alan respeitada: domínio atual é temporário → executado SÓ o que vive
      no código e não se refaz. `app/site.ts` = identidade única (nome +
      NEXT_PUBLIC_SITE_URL); títulos/canonicals/sitemap/robots/JSON-LD
      (WebApplication + FAQPage) derivam dele. FAQ de 5 perguntas na landing
      (= intenções reais de busca; a nº 2 "staked positions not showing" é o
      diferencial). /w/ com noindex. **SEO.md** = mapa de palavras-chave,
      posicionamento vs Revert/Metrix e CHECKLIST pós-domínio-definitivo
      (Search Console, sitemap submit, backlinks Base/DefiLlama, OG image) —
      NÃO executar antes do domínio final.
- [x] **Roadmap público** (12/07/2026): /roadmap + link no selo da landing;
      Uniswap v4 em Planned (fees por hooks = parte difícil, após rollout
      v3); sem GitHub (expunha repo pessoal). NOTA técnica: JSX do Next
      engole espaço após tag quando o texto seguinte tem entidade HTML —
      usar {" "} explícito (3 casos corrigidos).

- [x] **Receita B — Uniswap V3 na Base** (11/07/2026, Fable 5). Backup prévio
      em `backups/2026-07-11_fases0-7_completas` + tag git
      `fases-0-7-completas`. Entregas: `core/math/tickmath.ts` (port exato do
      TickMath em BigInt — vetores de teste = pares tick↔sqrt_ratio REAIS do
      fixture + extremos canônicos, exercitam todos os 20 coeficientes);
      `core/adapters/uniswap-v3/` (enumeração por NFT via multicall, amounts
      pela nossa matemática Q96, taxas via collect() SIMULADO — eth_call, 100%
      leitura — com fallback tokensOwed+aviso, teto de 1000 NFTs);
      `core/adapters/registry.ts` + agregação no service (Promise.allSettled:
      protocolo caído = warning/resposta parcial; todos caídos = 502); DTO:
      `protocol` → `protocols[]`; badge de protocolo nos cards; textos de
      cobertura atualizados; CLI agora roda o caminho completo de produção.
      60 testes (16 novos). ATENÇÃO: slot0 da Uniswap tem 7 campos (o do
      Slipstream tem 6) — ABIs separadas de propósito. vitest/tsc excluem
      `backups/`.
      Validação ao vivo: baleia 0xD3923BeC com 348 posições NOS DOIS
      protocolos (US$ 434.748, corte top-200 ok, zero avisos, 33 s local);
      carteira do Alan: 4 Aerodrome intactas + 1 Uniswap ESCONDIDA descoberta
      (WETH/BRETT 1%, NFT #651436 — o produto provou o valor no dono).

## Notas de desenvolvimento (Fase 4)
- **Modo fixture**: `TRACKDEFI_FIXTURE=poc/fixture-dto.json` faz a API servir
  um DTO congelado (7 posições reais) sem rede — é assim que o painel de
  preview do Claude (que roda SEM acesso à internet) consegue renderizar a
  página de resultados. NUNCA setar em produção. Os `.claude/launch.json`
  (deste projeto e do MeusGastos) já vêm com ele.
- **Next dev mode é lento para a varredura** (instrumentação de fetch):
  estoura o timeout de 50 s. Produção (`npm run build && npm run start`) faz
  em ~14 s. Testar desempenho SEMPRE em produção.
- Painel de preview no Windows: npm falha por caminho com espaços → launch
  usa `cmd.exe` + caminho curto 8.3 (`C:\Users\Pc\DOCUME~1\CLAUDE~1\TRACKD~1`).

## Notas para a Fase 6 (deploy)
- **Limite de duração da função Vercel**: a varredura leva ~12–16 s no RPC
  público. `maxDuration=60` está setado, mas o plano Vercel free pode capar
  em 10 s → conferir na Fase 6. Mitigação já mapeada: RPC pago (env) +
  cache derrubam a resposta típica para poucos segundos.
- `next-env.d.ts` e `.next/` são gitignored; o Next reconfigura o tsconfig
  (jsx react-jsx, isolatedModules) na 1ª build — já commitado assim.
- **TypeScript fixado em 5.x**: TS 7 (porta nativa) quebra a detecção de TS do
  Next 16 ("The id argument must be of type string"). NÃO subir para 7 até o
  Next suportar. O `tsc` puro funciona nas duas; o problema é só a integração.

## Achados da Fase 1 (para a Fase 2 resolver)
1. **Struct `Lp` divergente**: o contrato publicado (0x69dD…99A1) reverte no
   `byAddress` com o struct do branch main → o deployado é de versão anterior.
   Fase 2: baixar a ABI EXATA do contrato verificado no BaseScan (não confiar
   no branch main). O struct `Position` bate (positions() decodifica certo).
   Fallback atual: leitura direta do pool (token0/token1/tickSpacing/slot0)
   com emissões fixadas em AERO — funciona, mas perde o símbolo do pool.
2. **Escala**: ~34.250 pools nas 4 factories (10× o estimado). Varredura
   sequencial em janelas de 200 leva ~110 s no RPC público. Fase 2/3:
   paralelizar janelas (concorrência ~10 → ~15 s), cachear contagem de pools,
   e avaliar RPC pago se necessário. Investigar se
   positionsUnstakedConcentrated pagina por NFT da conta (mais barato) em vez
   de por pool.
3. Emissões de staked = sempre AERO na Aerodrome (confirmado nos valores).
4. DefiLlama funcionou (tokens obscuros sem preço → "—", conforme plano).
