# Publicar o trackdefi (grátis, na Vercel)

Guia passo a passo para o Alan. Os passos com **[VOCÊ]** só você pode fazer
(criam contas ou usam suas credenciais). Os com **[CLAUDE]** o Claude Code
executa para você quando você pedir.

Tudo aqui usa o plano gratuito. Custo: R$ 0.

---

## Parte 1 — Colocar o código no GitHub

1. **[VOCÊ] Criar uma conta no GitHub.** Acesse https://github.com/signup e
   crie uma conta gratuita (guarde e-mail e senha num gerenciador de senhas).

2. **[VOCÊ] Criar um repositório vazio.** Em https://github.com/new:
   - **Repository name:** `trackdefi`
   - Deixe **Public** (ou Private, tanto faz para a Vercel).
   - **NÃO** marque "Add a README", ".gitignore" nem "license" (o projeto já tem).
   - Clique **Create repository**.
   - Copie a URL que aparece, algo como `https://github.com/SEU_USUARIO/trackdefi.git`.

3. **[CLAUDE] Enviar o código.** Me mande essa URL e eu configuro o repositório
   remoto e faço o `push`. No primeiro envio, uma janela do Windows vai pedir
   para você entrar na sua conta GitHub — **essa autenticação é sua**; conclua
   no navegador que abrir. (Login por navegador; nunca cole senha no terminal.)

---

## Parte 2 — Publicar na Vercel

4. **[VOCÊ] Criar conta na Vercel entrando com o GitHub.** Em
   https://vercel.com/signup, escolha **Continue with GitHub** e autorize.
   Isso conecta as duas contas — é o caminho mais simples.

5. **[VOCÊ] Importar o projeto.**
   - No painel da Vercel, clique **Add New… → Project**.
   - Encontre `trackdefi` na lista e clique **Import**.
   - A Vercel detecta Next.js sozinha. **Não mude nada** nas configurações.
   - Clique **Deploy** e espere ~1–2 min.
   - No fim, você recebe uma URL tipo `https://trackdefi.vercel.app` — está no ar!

---

## Parte 3 — Ajustes recomendados (opcionais, no painel da Vercel)

6. **[VOCÊ] Deixar a busca mais rápida (RPC dedicado).** Sem isto o site
   funciona, mas cada busca leva ~15 s e pode estourar o limite de tempo da
   Vercel em carteiras grandes.
   - Crie uma conta grátis em https://alchemy.com, faça um app na rede **Base**
     e copie a **HTTPS URL**.
   - Na Vercel: projeto → **Settings → Environment Variables** → adicione
     **Name:** `BASE_RPC_URLS`  **Value:** a URL da Alchemy → **Save**.
   - Vá em **Deployments** e clique **Redeploy** no último deploy.

7. **[VOCÊ] Ligar as estatísticas sem cookies.** Projeto → aba **Analytics** →
   **Enable**. Pronto: passa a contar visitas sem cookies nem dados pessoais
   (o código já está no site).

---

## Depois de publicar

- **[CLAUDE] Validar em produção:** me diga a URL final e eu rodo a bateria de
  validação contra o site no ar.
- Cada vez que você aprovar uma mudança e pedir para eu enviar (`git push`), a
  Vercel republica sozinha em ~1 min.
- **Domínio próprio** (ex.: `trackdefi.xyz`) fica para depois de validar — dá
  para apontar um domínio comprado para a Vercel em Settings → Domains.

## Limitações conhecidas do plano grátis

- Funções da Vercel têm teto de tempo. Carteiras com **milhares** de posições de
  spam podem passar do limite e mostrar um erro honesto de timeout — é um caso
  patológico raro, aceitável no MVP. O RPC dedicado (passo 6) reduz muito isso.
