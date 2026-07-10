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
- [ ] Fase 5 — Validação e endurecimento — próxima (Fable 5).

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
