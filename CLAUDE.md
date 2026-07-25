# trackdefi — contexto do projeto (para o Claude Code)

Rastreador público e read-only de posições em pools de liquidez: cola o
endereço da carteira (0x…), sem login, e vê todas as posições. **NO AR:**
https://trackdefi.app (domínio próprio desde ~24/07/2026; o
`trackdefi.vercel.app` ainda responde) · repo:
https://github.com/alanmds/trackdefi (push na `main` → deploy automático).

⚠️ **Configuração de painel não vive no repo.** Domínio, variáveis de
ambiente (`NEXT_PUBLIC_SITE_URL`, RPCs), Analytics — tudo isso só existe na
Vercel e não chega aqui por git nem pelo Drive. Na dúvida sobre o que está
valendo, ler o site (`/robots.txt`, `/sitemap.xml`) ou rodar
`npx tsx poc/validate-live.ts <URL>`. Pendências em `privado/PENDENCIAS.md`.

Idioma de trabalho: **português**. Site: **inglês**. Dono: Alan (Rio de
Janeiro, não-programador). Windows.

## Ambiente (regra desde 17/07/2026)
- **O Alan trabalha em 2 computadores. Nomes fixos (usar SEMPRE estes):**
  - **Computador 1** → `C:\Users\Pc\Documents\Claude aplicacoes\trackdefi`
  - **Computador 2** → `D:\Documents\Claude aplicacoes\trackdefi`

  Este arquivo é lido nos dois — nunca escrever "aqui" ou "neste PC" ao falar
  de pasta; dizer o número. Para saber em qual você está, olhe o caminho da
  pasta de trabalho da sessão. É na pasta LOCAL que se edita, roda
  testes/build e faz commits.
- **Backup: `G:\Meu Drive\Claude aplicacoes\trackdefi`** (Google Drive). Após
  CADA modificação, espelhar a pasta local no backup — usar `npm run salvar`
  (scripts/salvar.cmd). O backup guarda também `ebook/`, `backups/`,
  `gemini/` (que ficam fora do GitHub).
- **Troca de computador:** `npm run retomar` ao chegar (git pull + npm
  install + pastas privadas do Drive); `npm run salvar` ao sair. O código
  viaja pelo **GitHub** (não pelo Drive). Ver COMO_RETOMAR.md.
- ARMADILHA: **não rodar `npm` dentro do Google Drive** — o `npm install` do
  zero falha lá (erros `TAR_ENTRY_ERROR` na extração paralela) e o Drive não
  aceita junction/symlink. Por isso trabalha-se no disco local e o Drive é só
  backup.
- Caminho tem espaços ("Claude aplicacoes") → no Windows, alguns comandos
  precisam de aspas ou do caminho curto 8.3 (o `.claude/launch.json` já usa).
- Trabalho remoto / outro PC: `git clone` para uma pasta LOCAL + `npm
  install`. Ver COMO_RETOMAR.md.

## Leia primeiro (a memória real do projeto)
- `PLANO_DE_TRABALHO.md` — histórico de todas as fases/expansões e decisões.
- `PLAYBOOK_EXPANSAO.md` — receitas para adicionar rede/protocolo (Receita A =
  ecossistema Sugar; Receita B = Uniswap).
- `privado/PENDENCIAS.md` — o que o Alan adiou, por tópico. Ler ao retomar e
  perguntar se algo dali entra na sessão.
- `privado/SEO.md` — **Plano de SEO v2** (fases S0–S7) já no domínio
  definitivo `trackdefi.app`. CONFIDENCIAL — saiu do GitHub em 25/07/2026;
  sincroniza via Drive. Passo a passo da fase em execução:
  `privado/PASSO_A_PASSO_S0.md`.
- `ebook/` (gitignored, local) — plano de monetização (material interno).

## Estado atual (jul/2026)
4 redes (Base, Optimism, Ethereum, Arbitrum) · 3 protocolos (Aerodrome,
Velodrome, Uniswap v3). Roadmap público em `/roadmap`.

## Stack e arquitetura
- Next.js (App Router) + TypeScript + viem. Preços: DefiLlama. Deploy: Vercel.
- **Regra anti-retrabalho:** todo código de protocolo vive atrás de
  `ProtocolAdapter` (`core/types.ts`). Rede/protocolo novo = adapter/config
  novos no `core/adapters/registry.ts`; API/UI/preços não mudam.
- `core/` = motor puro e testável; `app/` = site + `/api/positions`.
- Dinheiro em **BigInt** no core; float só na borda de exibição.

## Convenções invioláveis
1. **Publicar (git push) só com aprovação do Alan** — push vai direto para
   produção. Antes de publicar: `npm run typecheck && npm test && npm run build`.
2. Depois de cada deploy: `npx tsx poc/validate-live.ts https://trackdefi.app`.
3. Nova rede/protocolo: **PoC primeiro** (script em `poc/`) antes de tocar no
   site; confirmar endereços na doc OFICIAL, nunca de memória.
4. **TypeScript fixado em 5.x** — TS 7 quebra a integração do Next 16.
5. Preço tem chave multi-rede `chainId:endereço` (WETH tem o mesmo endereço
   em várias redes). Nunca inventar preço: sem preço → mostra "—".
6. Gitignored de propósito: `privado/`, `backups/`, `ebook/`, `gemini/` e
   `SEO.md`. **Todo arquivo confidencial novo vai em `privado/`** — nunca na
   raiz (o repo é PÚBLICO). Essas pastas sincronizam entre computadores via
   Drive (`npm run salvar` / `npm run retomar`), não via git.

## Comandos
- `npm run dev` (lento p/ varredura) · `npm run build && npm run start` (mede
  velocidade real) · `npm test` · `npm run typecheck`
- `npm run poc -- 0xENDERECO` — imprime posições (todas as redes)
- `npx tsx poc/validate-batch.ts` — bateria de validação (rodar antes de release)
- Deploy = `git push` (Vercel republica sozinha em ~1 min)
