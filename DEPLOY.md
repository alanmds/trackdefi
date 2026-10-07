# Publicar o trackdefi (grátis, na Vercel)

**O site já está no ar em https://trackdefi.app**, hospedado na Vercel no plano
gratuito. Custo: R$ 0.

Este documento tem duas partes: como o deploy funciona **hoje** (parte 1) e o
passo a passo original de instalação do zero (parte 2), útil para quem quiser
publicar a própria cópia.

---

## Parte 1 — Como funciona hoje

**Deploy é `git push` na branch `main`.** A Vercel republica sozinha em ~1 min.
Não há botão a apertar nem build manual.

Antes de qualquer push:

```bash
npm run typecheck && npm test && npm run build
```

Depois do deploy, validar a produção pela HTTP:

```bash
npx tsx poc/validate-live.ts https://trackdefi.app
```

### O que está configurado no painel da Vercel

Nada disto vive no repositório — só existe no painel:

| Item | Estado |
|---|---|
| Domínio principal | `trackdefi.app` |
| Redirecionamentos 308 | `www.trackdefi.app`, `trackdefi.xyz`, `www.trackdefi.xyz` e `trackdefi.vercel.app` apontam para o principal |
| `NEXT_PUBLIC_SITE_URL` | `https://trackdefi.app` (Production) |
| Web Analytics | ligado (sem cookies) |
| RPCs dedicados (`<REDE>_RPC_URLS`) | configurados nas redes em que o RPC público não serve histórico — ver abaixo |

> ⚠️ Os redirecionamentos do `trackdefi.xyz` precisam continuar de pé: existe
> uma "mudança de endereço" registrada no Google Search Console que depende
> deles.

### RPC dedicado (por rede)

Cada rede tem a sua variável — `BASE_RPC_URLS`, `OPTIMISM_RPC_URLS`,
`BSC_RPC_URLS` etc.; a lista completa é o campo `rpcEnv` em `core/chains.ts`.
Sem ela, a rede usa os RPCs públicos do mesmo arquivo. Duas razões para
configurar:

- **velocidade** em carteira grande;
- **o "Earning now" medido no contrato** (janelas de 24 h e 15 min) precisa de
  RPC que sirva estado de blocos passados. Vários RPCs públicos não servem
  (os da BNB Chain recusam; o oficial da HyperEVM responde o estado atual — o
  site detecta e mostra "—"). Sem histórico, o número cai na estimativa ou "—".
- **a enumeração do Uniswap v4**. O PositionManager do v4 não é enumerável, e
  na BNB Chain não dá para varrer o histórico (o RPC público aceita 2.000
  blocos por chamada e a chain tem 126M — medido em
  `poc/probe-v4-bnb-varredura.ts`). O trackdefi lê essas posições pelo índice
  do próprio RPC (`alchemy_getAssetTransfers`), que só existe na Alchemy:
  sem `BSC_RPC_URLS` com Alchemy, o v4 da BNB não é listado e o site diz isso
  em aviso, em vez de mostrar a carteira como se estivesse vazia.

Para configurar:

1. Crie uma conta grátis em https://alchemy.com, um app com as redes que
   quiser, e copie a **HTTPS URL** de cada uma.
2. Vercel → projeto → **Settings → Environment Variables** → **Name:** a
   variável da rede (ex.: `BSC_RPC_URLS`) · **Value:** a URL (várias separadas
   por vírgula) → **Save**.
3. **Deployments** → **Redeploy** no último deploy (variável só vale com deploy
   novo).

A chave fica só no servidor; nunca chega ao navegador.

---

## Parte 2 — Instalar do zero (histórico)

Feito em 10/07/2026. Mantido para quem quiser publicar a própria cópia.

### GitHub

1. Crie uma conta em https://github.com/signup.
2. Em https://github.com/new: nome `trackdefi`, **Public**, e **não** marque
   README/.gitignore/license (o projeto já tem).
3. `git remote add origin <URL>` e `git push -u origin main`. A autenticação
   abre no navegador — nunca cole senha no terminal.

### Vercel

4. Em https://vercel.com/signup, **Continue with GitHub** e autorize.
5. Painel → **Add New… → Project** → encontre `trackdefi` → **Import**.
6. A Vercel detecta Next.js sozinha. **Não mude nada.** → **Deploy** (~1–2 min).
7. Sai uma URL `*.vercel.app`. Para usar domínio próprio: **Settings → Domains**,
   com o apex como **Primary** e os demais como **Redirect (308)**. Depois,
   setar `NEXT_PUBLIC_SITE_URL` com o endereço final e redeployar.

### Estatísticas

8. Projeto → aba **Analytics** → **Enable**. O componente já está no layout;
   sem o clique no painel ele não coleta.

---

## Limitações conhecidas do plano grátis

Funções da Vercel têm teto de tempo. Carteiras com **milhares** de posições
(quase sempre spam de airdrop) podem passar do limite e receber um erro honesto
de timeout — caso patológico raro. O RPC dedicado reduz muito isso.
