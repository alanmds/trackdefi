# Publicar o trackdefi

**O site está no ar em https://trackdefi.app**, hospedado desde 15/11/2026 na
Hostinger (app web Node.js, servidor na Holanda). De 10/07 a 15/11/2026 ele
rodou na Vercel, no plano grátis — saiu porque a cota de CPU das funções
(4 h por 30 dias) acabava antes do mês.

Este documento tem duas partes: como o deploy funciona **hoje** (parte 1) e o
passo a passo original na Vercel (parte 2), útil para quem quiser publicar a
própria cópia de graça.

---

## Parte 1 — Como funciona hoje

**Deploy é `git push` na branch `main`.** A Hostinger ("Implantação
automática", ligada ao repositório público no GitHub) clona, roda
`npm install` e `npm run build` e republica sozinha em ~2 min. O andamento e
os logs ficam em hPanel → o site → **Implantações**.

Antes de qualquer push:

```bash
npm run typecheck && npm test && npm run build
```

Depois do deploy, validar a produção pela HTTP:

```bash
npx tsx poc/validate-live.ts https://trackdefi.app
```

> ⚠️ **O build usa Webpack (`next build --webpack`) de propósito.** O servidor
> da Hostinger tem uma glibc antiga, o binário nativo do Next não carrega lá e
> o Turbopack se recusa a compilar. Não tirar o `--webpack` do `package.json`.

### O que está configurado nos painéis

Nada disto vive no repositório:

| Onde | Item | Estado |
|---|---|---|
| Hostinger | Domínio do app | `trackdefi.app` (SSL automático da Hostinger) |
| Hostinger | `TRACKDEFI_PRODUCTION` | `1` — liga as travas de produção fora da Vercel (`app/api/hosting.ts`) |
| Hostinger | `NEXT_PUBLIC_SITE_URL` | `https://trackdefi.app` |
| Hostinger | `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` | contagem de visitas sem cookie (Cloudflare Web Analytics) |
| Hostinger | `FEEDBACK_WEBHOOK_URL` | formulário de feedback |
| Hostinger | RPCs dedicados (`<REDE>_RPC_URLS`) | ver abaixo |
| Vercel (DNS) | Nameservers do `trackdefi.app` | continuam na Vercel; o registro `A` do apex aponta para a Hostinger |
| Vercel | Redirecionamentos 308 | `www.trackdefi.app`, `trackdefi.xyz`, `www.trackdefi.xyz` e `trackdefi.vercel.app` → `trackdefi.app` |

> ⚠️ Os redirecionamentos do `trackdefi.xyz` precisam continuar de pé: existe
> uma "mudança de endereço" registrada no Google Search Console que depende
> deles. Por isso o projeto na Vercel não é apagado.

Variável `NEXT_PUBLIC_*` entra no código na hora do build: depois de mudar
uma, é preciso reimplantar (hPanel → **Implantações** → **Reimplantar**).

### RPC dedicado (por rede)

Cada rede tem a sua variável — `BASE_RPC_URLS`, `OPTIMISM_RPC_URLS`,
`BSC_RPC_URLS` etc.; a lista completa é o campo `rpcEnv` em `core/chains.ts`.
Sem ela, a rede usa os RPCs públicos do mesmo arquivo. Razões para
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
- **a Solana (Orca)**. O RPC público dela (`api.mainnet-beta.solana.com`)
  recusa com 429 depois de poucas leituras — serve para desenvolvimento, não
  para visitantes simultâneos. Em produção, `SOLANA_RPC_URLS` com um provedor
  (Helius, QuickNode… têm plano grátis). Sem ela, a Solana falha e o site
  avisa que as posições daquela rede podem faltar.

Para configurar:

1. Crie uma conta grátis em https://alchemy.com, um app com as redes que
   quiser, e copie a **HTTPS URL** de cada uma.
2. hPanel → o site → **Variáveis de ambiente** → **Adicionar variável de
   ambiente** (ou **Importar .env**) → **Aplicar mudanças**. O app reinicia
   sozinho.

A chave fica só no servidor; nunca chega ao navegador.

**Vários provedores grátis na mesma variável.** `BASE_RPC_URLS` aceita várias URLs
separadas por vírgula, e elas **dividem a carga** (`core/rpc-pool.ts`): os provedores que
não são da Alchemy (dRPC, Ankr, Infura, BlockPI…) revezam entre si, a Alchemy fica de
reserva (a cota dela é guardada para o que só ela faz: o índice do Uniswap v4 e a lista
de pools v2), e os RPCs públicos da rede são a última linha. Provedor que responde 429
ou cai sai da fila por alguns segundos e volta sozinho. `ALCHEMY_DAILY_CU` (padrão
800000) é um teto diário estimado: passado dele, a Alchemy sai da leitura comum até a
virada do dia (UTC). Para um provedor novo basta acrescentar a URL à variável da rede
e reaplicar as variáveis.

---

## Parte 2 — Instalar do zero na Vercel (grátis)

Feito em 10/07/2026. Mantido para quem quiser publicar a própria cópia: para
pouco tráfego, o plano grátis da Vercel basta.

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

---

## Limitações conhecidas

Carteiras com **milhares** de posições (quase sempre spam de airdrop) podem
passar do tempo máximo da varredura (50 s) e receber um erro honesto de
timeout — caso patológico raro. O RPC dedicado reduz muito isso.
