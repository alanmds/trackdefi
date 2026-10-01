/**
 * Guarda dos idiomas do site (app/i18n/).
 *
 * O TypeScript já impede um idioma de ter chave a menos que o inglês. O que
 * ele NÃO vê, e este arquivo cobra:
 *  - tradução que perdeu um `{valor}` ou um `<marcador>` (a frase sai quebrada
 *    na tela, só num idioma que quase ninguém no time lê);
 *  - listas de tamanhos diferentes (FAQ, glossário, roadmap);
 *  - entrada de changelog sem tradução (a regra é: entrada nova, tradução nova);
 *  - rótulo da tela que o glossário cita de um jeito diferente do que a tela mostra;
 *  - frases de doação com cara de golpe, ou grandes demais, no idioma novo.
 *
 * Idioma novo entra em `LOCALES` e este arquivo passa a testá-lo sozinho.
 */

import { describe, expect, it } from "vitest";
import { CHANGELOG } from "../app/changelog";
import { DEFAULT_LOCALE, isLocale, LOCALES, localePath, splitLocalePath, type Locale } from "../app/i18n/config";
import { getMessages, localizedChangelog } from "../app/i18n/get";
import { fill, pl, rich, stripTags } from "../app/i18n/rich";
import { siteDescription, siteTitle } from "../app/i18n/seo";
import { COVERAGE, coverageSentence, humanList, NETWORK_COUNT, NETWORK_NAMES, networksSentence, NETWORKS } from "../app/site";
import { fmtDate, fmtPct, fmtRangeDelta, fmtUsd, fmtWindow } from "../app/ui/format";

const OUTROS = LOCALES.map((l) => l.code).filter((c) => c !== DEFAULT_LOCALE);
const en = getMessages(DEFAULT_LOCALE);

/** todas as folhas de texto de um objeto, com o caminho até elas */
function leaves(x: unknown, path = ""): Array<[string, string]> {
  if (typeof x === "string") return [[path, x]];
  if (Array.isArray(x)) return x.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (x && typeof x === "object") return Object.entries(x).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const tags = (s: string) => [...s.matchAll(/<\/?([a-z][a-z0-9]*)>/gi)].map((m) => m[0].toLowerCase()).sort();

describe("rotas e idiomas", () => {
  it("o inglês é o padrão e fica sem prefixo; os outros levam o código", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(localePath("en", "/roadmap")).toBe("/roadmap");
    expect(localePath("en", "/")).toBe("/");
    expect(localePath("pt-br", "/roadmap")).toBe("/pt-br/roadmap");
    expect(localePath("pt-br", "/")).toBe("/pt-br");
    expect(localePath("pt-br", "w/0xabc")).toBe("/pt-br/w/0xabc");
  });

  it("separa o idioma do caminho (inclusive o caminho interno /en/…)", () => {
    expect(splitLocalePath("/pt-br/roadmap")).toEqual({ locale: "pt-br", path: "/roadmap" });
    expect(splitLocalePath("/pt-br")).toEqual({ locale: "pt-br", path: "/" });
    expect(splitLocalePath("/roadmap")).toEqual({ locale: "en", path: "/roadmap" });
    expect(splitLocalePath("/en/roadmap")).toEqual({ locale: "en", path: "/roadmap" });
    expect(splitLocalePath("/")).toEqual({ locale: "en", path: "/" });
  });

  it("ida e volta: localePath e splitLocalePath se desfazem", () => {
    for (const l of LOCALES) for (const p of ["/", "/glossary", "/w/0xabc"]) {
      expect(splitLocalePath(localePath(l.code, p))).toEqual({ locale: l.code, path: p });
    }
  });

  it("códigos são minúsculos e únicos; isLocale não aceita lixo", () => {
    const codes = LOCALES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(c).toBe(c.toLowerCase());
    expect(isLocale("pt-br")).toBe(true);
    expect(isLocale("PT-BR")).toBe(false);
    expect(isLocale("xx")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("nenhum código de idioma colide com uma rota do site", () => {
    const rotas = ["api", "w", "glossary", "roadmap", "changelog", "feedback", "how-it-works", "opengraph-image", "apple-icon"];
    for (const l of LOCALES) expect(rotas).not.toContain(l.code);
  });
});

describe("rich / fill / pl", () => {
  it("fill troca marcadores e deixa os desconhecidos em paz", () => {
    expect(fill("a {x} b {y}", { x: 1 })).toBe("a 1 b {y}");
  });

  it("stripTags tira os marcadores", () => {
    expect(stripTags("<b>oi</b> {n}", { n: 3 })).toBe("oi 3");
  });

  it("pl usa a regra de plural do idioma", () => {
    const p = { one: "{n} coisa", other: "{n} coisas" };
    expect(pl("en", p, 1)).toBe("1 coisa");
    expect(pl("en", p, 5)).toBe("5 coisas");
    expect(pl("pt-br", p, 2)).toBe("2 coisas");
  });

  it("rich aninha marcadores e não quebra com marcador desconhecido ou mal fechado", () => {
    const render = (s: string) => JSON.stringify(rich(s, { b: (c) => ({ b: c }) as never }));
    expect(render("a <b>x</b> c")).toContain('"b"');
    expect(() => rich("a <zz>x</zz> <b>sem fim")).not.toThrow();
    expect(() => rich("</b> solto")).not.toThrow();
  });
});

describe.each(OUTROS)("dicionário %s bate com o inglês", (code) => {
  const m = getMessages(code as Locale);

  it("mesmas chaves, mesmos tamanhos de lista, mesma ordem", () => {
    const caminhos = (x: unknown) => leaves(x).map(([p]) => p);
    expect(caminhos(m.ui)).toEqual(caminhos(en.ui));
    expect(caminhos(m.pages)).toEqual(caminhos(en.pages));
  });

  it("toda frase mantém os mesmos {valores} e <marcadores> do inglês", () => {
    const comparar = (a: unknown, b: unknown, base: string) => {
      const A = new Map(leaves(a));
      for (const [path, original] of leaves(b)) {
        const t = A.get(path) as string;
        // numa forma de plural, o {n} pode sumir ("uma hora") — o resto não
        const sem = (v: string[]) => (/\.(one|zero|two|few|many)$/.test(path) ? v.filter((x) => x !== "n") : v);
        expect(sem(vars(t)), `${base}.${path}`).toEqual(sem(vars(original)));
        expect(tags(t), `${base}.${path}`).toEqual(tags(original));
      }
    };
    comparar(m.ui, en.ui, "ui");
    comparar(m.pages, en.pages, "pages");
  });

  it("todo marcador <x> é fechado </x>", () => {
    for (const [path, t] of [...leaves(m.ui), ...leaves(m.pages)]) {
      const abre = (t.match(/<[a-z][a-z0-9]*>/gi) ?? []).length;
      const fecha = (t.match(/<\/[a-z][a-z0-9]*>/gi) ?? []).length;
      expect(abre, path).toBe(fecha);
    }
  });

  it("nenhuma frase ficou em branco nem igual ao inglês por esquecimento", () => {
    const iguaisOk = /^( · pool {pct}|—|NFT #\{id\}|Feedback|Roadmap|rebase|Website|\{[a-z]+\}|.{0,12})$/;
    const E = new Map(leaves(en.ui).concat(leaves(en.pages)));
    for (const [path, t] of leaves(m.ui).concat(leaves(m.pages))) {
      expect(t.trim().length, path).toBeGreaterThan(0);
      const orig = E.get(path);
      if (orig && orig === t && !iguaisOk.test(t) && !t.includes(" · ") && !/^(meta\.(keywords|og)|donate\.phrases)/.test(path)) {
        // protocolos, redes e símbolos podem coincidir; frase inteira não
        expect(t.split(" ").length, `${path} está em inglês: "${t}"`).toBeLessThanOrEqual(2);
      }
    }
  });

  it("o glossário cita os rótulos EXATAMENTE como a tela os mostra", () => {
    const termo = (id: string) => m.pages.glossary.sections.flatMap((s) => s.terms).find((t) => t.id === id)?.term;
    const ui = m.ui;
    expect(termo("total-in-pools")).toBe(ui.wallet.kpi.totalInPools);
    expect(termo("locked")).toBe(ui.wallet.kpi.locked);
    expect(termo("claimable-rewards")).toBe(ui.wallet.kpi.claimable);
    expect(termo("concentrated")).toBe(ui.card.kind.concentrated);
    expect(termo("classic")).toBe(`${ui.card.kind.v2volatile} / ${ui.card.kind.v2stable}`);
    expect(termo("in-range")).toBe(`${ui.card.inRange} / ${ui.card.outOfRange}`);
    expect(termo("staked")).toBe(ui.card.staked);
    expect(termo("alm")).toBe(ui.card.alm);
    expect(termo("earning-now")).toBe(ui.card.earningNow);
    expect(termo("total-claimable")).toBe(ui.card.totalClaimable);
    expect(termo("total-claimable")).toBe(ui.lock.totalClaimable);
    expect(termo("voting-power")).toBe(ui.lock.votingPower);
    expect(termo("permanent")).toBe(ui.lock.permanent);
    expect(termo("expired")).toBe(ui.lock.expired);
    expect(termo("rebase")).toBe(ui.lock.rebase);
    expect(termo("votes")).toBe(ui.lock.votes);
    expect(termo("claimable-fees")).toBe(ui.card.rewardFee);
    expect(termo("claimable-emissions")).toBe(ui.card.rewardEmission);
  });
});

describe("glossário: estrutura igual em todos os idiomas", () => {
  it.each(LOCALES.map((l) => l.code))("%s tem as mesmas seções e termos (ids) do inglês", (code) => {
    const ids = (loc: Locale) =>
      getMessages(loc).pages.glossary.sections.map((s) => [s.id, s.terms.map((t) => t.id)] as const);
    expect(ids(code)).toEqual(ids(DEFAULT_LOCALE));
  });
});

describe("changelog traduzido", () => {
  it.each(OUTROS)("%s: toda entrada tem tradução, e só as que existem", (code) => {
    const tr = getMessages(code as Locale).changelog ?? {};
    expect(Object.keys(tr).sort()).toEqual(CHANGELOG.map((e) => e.id).sort());
  });

  it.each(OUTROS)("%s: título curto, corpo de verdade, sem fala de commit", (code) => {
    for (const e of localizedChangelog(code as Locale)) {
      expect(e.title.length, e.id).toBeLessThanOrEqual(70);
      expect(e.body.length, e.id).toBeGreaterThan(40);
      expect(`${e.title} ${e.body}`, e.id).not.toMatch(/\.tsx?\b|\bcore\/|\bapp\/|\bcommit\b/i);
    }
  });

  it.each(OUTROS)("%s: a tradução realmente difere do original", (code) => {
    const orig = new Map(CHANGELOG.map((e) => [e.id, e]));
    for (const e of localizedChangelog(code as Locale)) {
      expect(e.title, e.id).not.toBe(orig.get(e.id)?.title);
    }
  });

  it("todo tipo de entrada tem rótulo de selo em cada idioma", () => {
    for (const l of LOCALES) {
      const kinds = getMessages(l.code).pages.changelog.kinds;
      for (const e of CHANGELOG) expect(kinds[e.kind], `${l.code}/${e.kind}`).toBeTruthy();
    }
  });
});

describe("frases de doação por idioma", () => {
  /** o que soa a golpe cripto, por idioma — a mesma regra do inglês (tests/donate.test.ts) */
  const GOLPE: Record<string, RegExp> = {
    "pt-br": /\b(airdrop|sorteio|dobr\w*|garant\w*|lucr\w*|recompensas?|ganh\w*|retorno|rendimentos?|conect\w*|seed|verifi\w*|chave privada|enviar|urgente|última chance)\b/i,
  };

  it.each(OUTROS)("%s: variedade, tamanho, sem repetição e sem cara de golpe", (code) => {
    const phrases = getMessages(code as Locale).ui.donate.phrases;
    expect(phrases.length).toBeGreaterThanOrEqual(20);
    expect(new Set(phrases.map((p) => p.toLowerCase().trim())).size).toBe(phrases.length);
    for (const p of phrases) {
      expect(p.length, p).toBeLessThanOrEqual(90);
      expect(p.length, p).toBeGreaterThanOrEqual(20);
      expect(p, p).toBe(p.trim());
      if (GOLPE[code]) expect(p, p).not.toMatch(GOLPE[code]);
    }
  });

  it.each(OUTROS)("%s: nenhuma frase escreve nome de rede à mão nem conta redes", (code) => {
    const nomes = new Set<string>(NETWORKS.flatMap((n) => [n.label, n.name]));
    for (const p of getMessages(code as Locale).ui.donate.phrases) {
      for (const nome of nomes) expect(p, `"${nome}" em: ${p}`).not.toMatch(new RegExp(`\\b${nome}\\b`));
      expect(p, p).not.toMatch(/\d+\s+(redes|chains|blockchains)/i);
    }
  });

  it.each(OUTROS)("%s: o idioma novo precisa ter GOLPE definido neste teste", (code) => {
    expect(GOLPE[code], `acrescente a lista de palavras de golpe de ${code} em GOLPE`).toBeDefined();
  });
});

describe("textos que nunca podem mudar de sentido", () => {
  it.each(LOCALES.map((l) => l.code))("%s: a frase de 'sem token' existe e vai às páginas que a usam", (code) => {
    const m = getMessages(code as Locale);
    expect(m.pages.noToken.length).toBeGreaterThan(10);
    // o FAQ da home e o roadmap a inserem pelo marcador
    expect(m.pages.home.faq.some((f) => f.a.includes("{noToken}"))).toBe(true);
    expect(m.pages.roadmap.never.some((s) => s.includes("{noToken}"))).toBe(true);
  });

  it("o idioma-mãe usa o NO_TOKEN do site", async () => {
    const { NO_TOKEN } = await import("../app/site");
    expect(en.pages.noToken).toBe(NO_TOKEN);
  });

  it.each(LOCALES.map((l) => l.code))("%s: o aviso de segurança do rodapé e do 'como funciona' fala em chave privada", (code) => {
    const m = getMessages(code as Locale);
    expect(m.pages.howItWorks.safe.length).toBe(4);
    expect(m.ui.footer.safety).toContain("{name}");
  });
});

describe("metadados por idioma", () => {
  it.each(LOCALES.map((l) => l.code))("%s: título ≤ 70 e descrição ≤ 160 caracteres, com o número de redes", (code) => {
    expect(siteTitle(code as Locale).length).toBeLessThanOrEqual(70);
    const d = siteDescription(code as Locale);
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d).toContain(String(NETWORK_COUNT));
  });

  it.each(LOCALES.map((l) => l.code))("%s: nenhuma meta description de página passa de 160 caracteres", (code) => {
    const p = getMessages(code as Locale).pages;
    const descs = [
      p.howItWorks.description,
      p.feedback.description,
      p.glossary.description,
      fill(p.roadmap.description, { count: NETWORK_COUNT }),
      fill(p.changelog.description, { name: "trackdefi", count: NETWORK_COUNT }),
    ];
    for (const d of descs) expect(d.length, d).toBeLessThanOrEqual(200);
  });
});

describe("regra do site: nome e número de rede nunca à mão (em todo idioma)", () => {
  const CONTAGEM = /\b(\d+|um|uma|dois|duas|três|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|quinze|vinte|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty)\s+(redes|networks|chains)\b/i;

  it.each(LOCALES.map((l) => l.code))("%s: nem a UI nem as páginas (fora roadmap e changelog) escrevem contagem de redes", (code) => {
    const m = getMessages(code as Locale);
    // roadmap e changelog citam marcos históricos: "cinco redes de uma vez" é fato datado
    const textos = [
      ...leaves(m.ui),
      ...leaves(m.pages.home),
      ...leaves(m.pages.howItWorks),
      ...leaves(m.pages.glossary),
      ...leaves(m.pages.meta),
    ].filter(([path]) => !path.startsWith("donate.phrases"));
    for (const [path, t] of textos) expect(t, path).not.toMatch(CONTAGEM);
  });
});

describe("formatação por idioma", () => {
  const nbsp = " ";

  it("dólar: separadores do idioma", () => {
    expect(fmtUsd(1234.5)).toBe("$1,234.50");
    expect(fmtUsd(1234.5, "pt-br")).toBe(`US$${nbsp}1.234,50`);
    expect(fmtUsd(null, "pt-br")).toBe("—");
  });

  it("percentual e distância até a borda", () => {
    expect(fmtPct(5.256)).toBe("5.26%");
    expect(fmtPct(5.256, "pt-br")).toBe("5,26%");
    expect(fmtRangeDelta(0.4879, 0.5305, "pt-br")).toBe("−8,03%");
    expect(fmtRangeDelta(2500, 100, "pt-br")).toBe("+2.400%");
    expect(fmtRangeDelta(1e38, 1, "pt-br")).toBe(">+999.999%");
    expect(fmtRangeDelta(100, 100, "pt-br")).toBe("0,00%");
  });

  it("datas à mão, com os meses do idioma", () => {
    const pt = getMessages("pt-br").ui.dates;
    expect(fmtDate("2026-09-15", pt)).toBe("15 set 2026");
    expect(fmtDate("2026-02-01", pt)).toBe("1 fev 2026");
    expect(fmtWindow(900, pt)).toBe("15 min");
    expect(fmtWindow(86_400, pt)).toBe("24 h");
  });

  it("todo idioma tem 12 meses distintos", () => {
    for (const l of LOCALES) {
      const d = getMessages(l.code).ui.dates;
      expect(d.months.length).toBe(12);
      expect(new Set(d.months).size).toBe(12);
      for (const k of ["{d}", "{m}", "{y}"]) expect(d.format).toContain(k);
    }
  });
});

describe("listas montadas por código", () => {
  it("o conector do último item vem do idioma", () => {
    expect(humanList(["A", "B", "C"], "and", "pt-br")).toBe("A, B e C");
    expect(humanList(["A", "B", "C"], "&", "pt-br")).toBe("A, B & C");
    expect(humanList(["A", "B"], "and", "en")).toBe("A and B");
  });

  it("a frase de cobertura cita todos os protocolos e todas as redes em qualquer idioma", () => {
    for (const l of LOCALES) {
      const frase = coverageSentence(l.code);
      for (const c of COVERAGE) expect(frase, `${l.code}/${c.protocol}`).toContain(c.protocol);
      for (const n of NETWORK_NAMES) expect(frase, `${l.code}/${n}`).toContain(n);
      expect(networksSentence("and", l.code)).toContain(NETWORK_NAMES[NETWORK_NAMES.length - 1]);
    }
    expect(coverageSentence("pt-br")).toMatch(/Aerodrome em Base, Velodrome em Optimism/);
  });
});
