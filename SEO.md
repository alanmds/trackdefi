# Estratégia de SEO — trackdefi

> Criado em 12/07/2026. REGRA DESTE DOCUMENTO (definida pelo Alan): o domínio
> atual (trackdefi.vercel.app) é temporário e o nome pode mudar. Por isso, SÓ
> foi executado o SEO que NÃO precisa ser refeito (vive no código e viaja com
> o repo). Tudo que depende do domínio/nome definitivo está no checklist
> "Depois do domínio definitivo" — NÃO executar antes.

## Anti-retrabalho: onde mudar nome/domínio

**Tudo** (título, descrições, canonicals, sitemap, robots, dados
estruturados, textos que citam a marca) deriva de **`app/site.ts`**:

1. Trocar `SITE_NAME` (se o nome mudar) em `app/site.ts`.
2. Setar `NEXT_PUBLIC_SITE_URL=https://dominio-definitivo.com` na Vercel
   (Settings → Environment Variables) e fazer redeploy.
3. Conferir: o `*.vercel.app` antigo passa a redirecionar (308) para o
   domínio primário automaticamente — os sinais de indexação migram.

## Posicionamento vs. concorrentes

- **Revert** (revert.finance): "powerful analytics, automation and management
  tools" — foco em analytics profundo e gestão para LPs sofisticados
  (Uniswap, Sushi, Curve, Balancer). Não cobre Aerodrome/gauges da Base.
- **Metrix** (metrix.finance): "enterprise-grade analytics… maximize returns"
  — foco em simulação/planejamento, exige cadastro para recursos.
- **Nosso ângulo** (deliberadamente oposto): *instantâneo, grátis, sem login,
  cola-o-endereço-e-pronto*, e o ÚNICO que mostra posições em stake nos
  gauges da Aerodrome com emissões AERO. Nicho primeiro (Base/Aerodrome),
  não competimos de frente com "analytics enterprise".

## Mapa de palavras-chave → página

Sugeridas pelo Alan: Base, aerodrome, crypto pool, liquid pool, track pool,
find pool, discover pool. Refinadas para os termos que o público REALMENTE
digita ("liquid pool" tem volume ~zero; "liquidity pool" é o termo):

| Intenção de busca | Termo-alvo | Página/elemento |
|---|---|---|
| Rastrear posições na Aerodrome | aerodrome position tracker, aerodrome lp tracker, track aerodrome positions | title da home + FAQ 1/2 |
| Problema real nº 1 (nosso diferencial) | staked aerodrome positions not showing in wallet, where are my aerodrome lp tokens | **FAQ 2** + feature card |
| Rastrear pools na Base | base liquidity pool tracker, base lp tracker, crypto pool tracker base | title/description da home |
| Uniswap na Base | uniswap v3 position tracker base | title + FAQ 4 |
| Genéricos de cauda | liquidity pool tracker by wallet address, check lp positions wallet, find pools by wallet, free lp tracker | description + FAQ 1/3/5 |
| Confiança | lp tracker without connecting wallet, read-only defi tracker | FAQ 3 + how-it-works |

Termos de cabeça ("liquidity pool", "crypto pool") são dominados por
exchanges/wikis — não são alvo realista agora; entram por arrasto na cauda.

## O que foi implementado (12/07/2026 — vive no código)

- `app/site.ts`: identidade única (nome, URL por env, título ≤70c, descrição
  ~160c com as palavras-alvo).
- Títulos por template (`%s — trackdefi`) + canonicals em todas as páginas
  indexáveis; `metadataBase` para OG/canonical absolutos.
- **JSON-LD**: `WebApplication` (grátis, FinanceApplication) no layout +
  `FAQPage` na home (5 perguntas VISÍVEIS na página, como o Google exige).
- **FAQ na landing**: 5 perguntas = intenções de busca reais (tabela acima),
  em `<details>` nativo (sem JS, acessível).
- `app/sitemap.ts` (3 páginas indexáveis) + referência no robots.txt.
- Páginas de carteira `/w/…`: `noindex,nofollow` no meta (além do bloqueio
  no robots) — são infinitas e canibalizariam o crawl.
- OG/Twitter herdados do site.ts.

## Depois do domínio definitivo (checklist — NÃO fazer antes)

1. `app/site.ts` + `NEXT_PUBLIC_SITE_URL` (ver topo).
2. **Google Search Console**: registrar o domínio novo, submeter
   `/sitemap.xml`, pedir indexação das 3 páginas. (Bing Webmaster idem, 5 min.)
3. Conferir redirect 308 do `*.vercel.app` → domínio novo.
4. **Backlinks/distribuição** (o que realmente move ranking em nicho):
   - Listagem no ecossistema Base (base.org/ecosystem) e na DefiLlama;
   - Comunidades Aerodrome/Velodrome (Discord tem canal de ferramentas);
   - Post de lançamento no X/Twitter e no Farcaster (público Base é forte lá);
   - Responder perguntas "staked positions not showing" no Reddit
     (r/defi, r/BASE_chain) linkando a FAQ.
5. **OG image** (imagem de compartilhamento com a marca definitiva) — só faz
   sentido com nome final; usar `opengraph-image.tsx` do Next.
6. Monitorar no Search Console quais consultas trazem impressões e ajustar
   FAQ/títulos conforme o que aparecer (SEO é iterativo).

## O que decidimos NÃO fazer (e por quê)

- Páginas "vs Revert / vs Metrix": conteúdo raso agora; reavaliar quando
  houver tráfego.
- Blog/conteúdo educativo: alto custo de manutenção; a FAQ cobre a cauda
  por ora.
- Qualquer link building no domínio temporário: seria refeito (regra do topo).
