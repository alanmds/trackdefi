/**
 * Avisa os buscadores do IndexNow (Bing, Yandex, Seznam, Naver, Yep) de que as
 * páginas do sitemap mudaram. Rodar DEPOIS de cada deploy que muda texto,
 * junto do `validate-live`:
 *
 *   npx tsx poc/indexnow.ts            (usa https://trackdefi.app)
 *   npx tsx poc/indexnow.ts <URL>
 *
 * Por que (GEO, 30/09/2026): o Bing alimenta o Copilot e é parceiro histórico
 * da busca do ChatGPT — as duas IAs que mais nos recomendam. Sem o aviso, o
 * Bing descobre a mudança quando quiser; com ele, em horas. O Google não usa
 * IndexNow (lá o caminho continua sendo o Search Console).
 *
 * A chave NÃO é segredo: o protocolo exige que ela seja servida publicamente
 * em `/<chave>.txt` (arquivo em `public/`), e é isso que prova que o domínio é
 * nosso. Uma requisição por execução — nada de laço (memória "não martelar a
 * produção").
 */

const KEY = "ccddd4cbfede66d5c1eeeb7490a2eab6";
const site = (process.argv[2] ?? "https://trackdefi.app").replace(/\/$/, "");
const host = new URL(site).host;

async function main() {
  // 1. a chave tem de estar no ar antes do aviso, senão o IndexNow recusa (403)
  const k = await fetch(`${site}/${KEY}.txt`);
  const kText = (await k.text()).trim();
  if (!k.ok || kText !== KEY) {
    console.error(`✗ chave não está no ar em ${site}/${KEY}.txt (HTTP ${k.status}). Deploy feito?`);
    process.exit(1);
  }

  // 2. as URLs saem do sitemap publicado — a mesma lista que o Google recebe
  const xml = await (await fetch(`${site}/sitemap.xml`)).text();
  const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  urlList.push(`${site}/llms.txt`);
  if (urlList.length === 1) {
    console.error("✗ sitemap sem URLs — nada a avisar.");
    process.exit(1);
  }

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key: KEY, keyLocation: `${site}/${KEY}.txt`, urlList }),
  });

  // 200 = recebido; 202 = recebido, chave ainda em validação. Ambos são sucesso.
  const ok = res.status === 200 || res.status === 202;
  console.log(`${ok ? "✓" : "✗"} IndexNow HTTP ${res.status} — ${urlList.length} URLs`);
  for (const u of urlList) console.log(`  ${u}`);
  if (!ok) {
    console.error(await res.text());
    process.exit(1);
  }
}

main();
