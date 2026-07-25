# Como retomar o trackdefi (guia para o Alan)

Você trabalha em **dois computadores**. Este guia diz o que fazer ao **chegar**
num computador e ao **sair** dele. O arquivo está no GitHub de propósito —
assim ele existe em qualquer computador onde você clonar o projeto.

## O fluxo em 3 peças

| Peça | Papel | Regra |
|---|---|---|
| **GitHub** (github.com/alanmds/trackdefi) | É por aqui que o **código** viaja entre computadores (`git push` leva, `git pull` traz). | Push na `main` = site publicado na hora. Trabalho no meio → push numa **branch**. |
| **Google Drive** (`G:\Meu Drive\Claude aplicacoes\trackdefi`) | **Backup** + pastas privadas que não vão ao GitHub (`privado/`, `ebook/`, `gemini/`, `backups/`). | **Nunca** trabalhar nem rodar `npm` dentro do Drive (o `npm install` quebra lá). |
| **Pasta local** (uma em cada computador) | Onde se trabalha de verdade: Claude Code, comandos, commits. | Neste PC: `C:\Users\Pc\Documents\Claude aplicacoes\trackdefi`. No outro: `D:\Documents\Claude aplicacoes\trackdefi`. |

> A peça que sincroniza o código é o **GitHub**, não o Drive. O que não foi
> para o GitHub **não aparece** no outro computador.

## ✅ CHEGANDO num computador — 1 comando

Abra o Claude Code **na pasta local** do computador e rode (ou peça ao Claude):

```bash
npm run retomar
```

O script faz tudo: `git pull` (traz o código mais novo do GitHub),
`npm install` (atualiza dependências) e copia `privado/`, `ebook/`,
`gemini/` e `backups/` do Drive para a pasta local (só o que for mais novo).
No fim mostra o estado do git.

Depois é só dizer ao Claude: **"leia o CLAUDE.md e o PLANO_DE_TRABALHO.md e
vamos continuar"** — ele se situa sozinho.

## 🚪 SAINDO de um computador — 1 decisão + 1 comando

1. **Decida o destino do que você fez** (peça ao Claude para commitar):
   - **Pronto para publicar** → aprove o push na `main` (o Claude roda
     `typecheck + test + build` antes; a Vercel publica em ~1 min).
   - **Trabalho no meio** → peça push numa branch, por exemplo
     `git push origin em-andamento`. Chega ao outro computador **sem**
     publicar o site (lá: `git checkout em-andamento` depois do retomar).
2. Rode o backup:

```bash
npm run salvar
```

O script espelha a pasta local no Drive (código + pastas privadas) e **avisa
se ficou algo fora do GitHub** — se avisar, volte ao passo 1.

> **Rede de segurança:** ao fechar uma sessão do Claude Code, um hook roda o
> backup para o Drive sozinho (`.claude/settings.json` → `backup-auto.cmd`).
> Mesmo assim, rode o `salvar` ao sair — é ele que mostra o aviso do git.

## ⚠️ Migração única no computador 2 (D:\Documents\...) — 25/07/2026

Passo que se faz **uma vez só**, na primeira vez que o computador 2 for
usado depois de 25/07/2026. Motivo: o SEO.md saiu do GitHub e virou
`privado/SEO.md`, e a versão mais nova dele existe só no disco de lá — um
`git pull` direto passaria por cima. Abra o Claude Code **na pasta de lá** e
peça a ele para fazer a migração (o texto pronto está no fim desta seção).

A sequência segura é: **1)** conferir o `git status` (pode haver outros
arquivos modificados lá que ninguém commitou); **2)** mover o `SEO.md` da
raiz para `privado/`; **3)** resolver o que o status mostrar; **4)**
`git pull`; **5)** `npm install`.

O histórico do git **não** foi reescrito (ficou como pendência), então um
`git pull` normal funciona — **não** use `git reset --hard`, ele apagaria o
trabalho não commitado que estiver lá.

Quando terminar, **apague esta seção do arquivo** — ela serve uma vez só e
depois vira informação velha que confunde (foi o que aconteceu com a versão
anterior deste guia).

## 🔒 Arquivos confidenciais

O repositório do GitHub é **PÚBLICO**. Regra: **todo arquivo que não pode ser
público vai na pasta `privado/`** (gitignored; ex.: `privado/SEO.md`). Ela
sincroniza entre computadores **pelo Drive** (salvar/retomar, o mais novo
vence) — por isso, edite arquivos privados num computador de cada vez e rode
o `salvar` antes de trocar. `ebook/`, `gemini/` e `backups/` seguem a mesma
lógica.

## 🆕 Computador NOVO (primeira vez)

1. Instale **Node.js LTS** (nodejs.org), **Git** (git-scm.com) e o
   **Claude Code**; faça login na conta Anthropic (a assinatura acompanha).
2. Num terminal, em qualquer pasta **LOCAL** (nunca dentro de Drive/OneDrive):

```bash
git clone https://github.com/alanmds/trackdefi.git
```

3. Abra a pasta `trackdefi` no Claude Code e rode `npm run retomar`
   (ele instala as dependências e, se o Drive estiver montado, traz as
   pastas privadas; sem Drive ele só avisa e segue).
4. Anote a nova pasta local na tabela do topo deste arquivo.

Nenhuma senha ou chave existe no projeto — login de GitHub/Vercel é pelo
navegador.

## Regras de ouro

- **Nunca rodar `npm` nem trabalhar dentro do Google Drive** — o
  `npm install` falha lá (`TAR_ENTRY_ERROR`) e o Drive não aceita atalhos.
  Drive é só backup, via `npm run salvar`.
- **Push na `main` só com sua aprovação** — vai direto para produção.
- O caminho local tem espaços ("Claude aplicacoes") — alguns comandos no
  Windows precisam de aspas; os scripts já tratam disso.

## Cola de comandos (na pasta local)

| Objetivo | Comando |
|---|---|
| **Chegando: atualizar tudo** | `npm run retomar` |
| **Saindo: backup no Drive** | `npm run salvar` |
| Rodar os testes | `npm test` |
| Site local em velocidade real | `npm run build` e depois `npm run start` → http://localhost:3000 |
| Ver posições de uma carteira | `npm run poc -- 0xENDERECO` |
| Bateria de validação (antes de release) | `npx tsx poc/validate-batch.ts` |
| Publicar (após sua aprovação) | `git push` (Vercel republica em ~1 min) |
| Conferir produção após deploy | `npx tsx poc/validate-live.ts https://trackdefi.vercel.app` |
