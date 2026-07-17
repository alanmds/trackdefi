# Como retomar o trackdefi (guia para o Alan)

Guia para (a) continuar em outro computador e (b) abrir a pasta certa no
Claude Code. Este arquivo está no GitHub de propósito — assim ele estará lá
quando você clonar o projeto no computador novo.

---

## ⚠️ REGRA DE OURO: trabalhar no LOCAL, fazer BACKUP no Drive

Aprendido em 17/07/2026: **não se roda projeto Node dentro do Google Drive**.
O `npm install` do zero falha lá (erros `TAR_ENTRY_ERROR` na extração de
milhares de arquivos) e o Drive nem aceita atalhos (junction/symlink). O mesmo
vale para OneDrive/Dropbox.

**Como fica a organização:**

- **`C:\Users\Pc\Documents\Claude aplicacoes\trackdefi`** — a **pasta local de
  trabalho**. É aqui que o Claude Code abre a sessão, que os comandos rodam e
  que se faz commit.
- **`G:\Meu Drive\Claude aplicacoes\trackdefi`** — **backup no Google Drive**.
  Depois de cada modificação, a pasta local é espelhada aqui (`robocopy`).
  Guarda também `ebook/`, `backups/` e `gemini/` (que não vão ao GitHub de
  propósito). Nunca rodar `npm` aqui.
- GitHub (https://github.com/alanmds/trackdefi) — a **ponte entre
  computadores**. `git push` (com sua aprovação) leva; `git pull` traz.

**Para montar em OUTRO computador (trabalho remoto):**

```
git clone https://github.com/alanmds/trackdefi.git
cd trackdefi
npm install
npm test
```

(Qualquer pasta LOCAL serve — só não use pasta de nuvem sincronizada como
pasta de trabalho.)

## A) Por que aparece "MeusGastos_v2" no topo (a confusão)

A sessão atual do Claude Code foi aberta na pasta **MeusGastos_v2** (outro
projeto seu). Todo o trackdefi foi construído numa pasta VIZINHA
(`...\Claude aplicacoes\trackdefi`), com o Claude usando caminhos completos.
Funcionou — o site está no ar e tudo está no GitHub — mas o certo, daqui pra
frente, é abrir a sessão **na pasta trackdefi**. Aí o contexto (o `CLAUDE.md`)
carrega sozinho e os comandos rodam no lugar certo.

## B) Abrir a pasta trackdefi no app do Claude Code

1. Clique em **"Nova sessão"** (canto superior esquerdo).
2. O app pede/permite escolher a **pasta de trabalho** — aponte para:
   `C:\Users\Pc\Documents\Claude aplicacoes\trackdefi` (a pasta local; ver
   REGRA DE OURO acima)
3. Pronto: o topo passa a mostrar **trackdefi**. Diga "leia o CLAUDE.md e o
   plano e vamos continuar" — o Claude se situa em segundos.

Se não achar o seletor de pasta, veja a opção "VS Code" abaixo (é mais visual).

## C) Continuar em OUTRO computador (sua semana fora)

O código está seguro no GitHub. No computador novo:

1. Instale **Node.js LTS** (nodejs.org), **Git** (git-scm.com) e o
   **Claude Code**; faça login na sua conta Anthropic (a assinatura te segue).
2. Baixe o projeto e as dependências (abra um terminal):
   ```
   git clone https://github.com/alanmds/trackdefi.git
   cd trackdefi
   npm install
   ```
   (Sempre em pasta LOCAL, nunca dentro de Google Drive/OneDrive — ver a
   REGRA DE OURO no topo.)
3. Abra a pasta `trackdefi` no Claude Code (passo B) e continue.

**Não viaja pelo GitHub (só neste computador):** a pasta `ebook/` e os
`backups/`. Se quiser levá-los, copie-os à parte (pen drive/nuvem pessoal).
Nenhuma senha/chave existe no projeto — login de GitHub/Vercel é por navegador.

⚠️ Se o computador for do trabalho, confirme a política da empresa antes de
instalar programas ou logar contas pessoais.

## D) Claude Code no VS Code (alternativa mais visual)

Se preferir "abrir pasta" como no VS Code:
1. Instale o **VS Code** e a extensão **Claude Code** (Marketplace).
2. No VS Code: **File → Open Folder →** escolha a pasta `trackdefi`.
3. Abra o painel do Claude Code — ele já trabalha na pasta aberta.

Sobre o **Antigravity** (ou outras IDEs de IA): dá para editar os arquivos
nelas, mas o Claude Code oficial é o app da Anthropic ou a extensão do VS
Code. Recomendo ficar num desses dois para não misturar ferramentas.

## E) Cola de comandos (no terminal, dentro da pasta trackdefi)

| Objetivo | Comando |
|---|---|
| Rodar os testes | `npm test` |
| Ver o site local (rápido de medir) | `npm run build` e depois `npm run start` → http://localhost:3000 |
| Ver posições de uma carteira | `npm run poc -- 0xENDERECO` |
| Publicar mudanças aprovadas | `git push` (a Vercel republica em ~1 min) |
| Conferir produção após deploy | `npx tsx poc/validate-live.ts https://trackdefi.vercel.app` |

Deploy = `git push`. Sempre peça ao Claude para rodar testes + build antes, e
só publique o que você aprovou.
