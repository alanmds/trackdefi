import type { MetadataRoute } from "next";
import { CHANGELOG } from "./changelog";
import { DEFAULT_LOCALE, LOCALES, localePath, type Locale } from "./i18n/config";
import { SITE_URL } from "./site";
import { EDITADA_EM } from "./sitemap-datas";

/**
 * Dia em que cada idioma foi ao ar. Uma tradução nova nunca tem `lastmod`
 * anterior a isso, mesmo que o texto-base seja mais antigo.
 */
const IDIOMA_AO_AR: Partial<Record<Locale, string>> = {
  "pt-br": "2026-09-30",
};

const dia = (d: string) => new Date(`${d}T12:00:00Z`);
const maisRecente = (a: string, b?: string) => (b && b > a ? b : a);

interface Pagina {
  path: string;
  /** data do conteúdo (já considerando o log, quando a página o exibe) */
  data: string;
  changeFrequency: "weekly" | "monthly";
  priority: number;
}

/** home e roadmap exibem a data da última entrada do changelog — ela conta */
const PAGINAS: Pagina[] = [
  { path: "/", data: maisRecente(EDITADA_EM.home, CHANGELOG[0].date), changeFrequency: "weekly", priority: 1 },
  { path: "/how-it-works", data: EDITADA_EM.howItWorks, changeFrequency: "monthly", priority: 0.8 },
  { path: "/roadmap", data: maisRecente(EDITADA_EM.roadmap, CHANGELOG[0].date), changeFrequency: "monthly", priority: 0.7 },
  { path: "/glossary", data: EDITADA_EM.glossary, changeFrequency: "monthly", priority: 0.6 },
  // a data da última entrada do log — é exatamente quando a página mudou
  { path: "/changelog", data: CHANGELOG[0].date, changeFrequency: "weekly", priority: 0.6 },
];

/** Sitemap das páginas indexáveis, uma entrada por página e idioma, cada uma
 * apontando para as suas irmãs (hreflang). Páginas de carteira ficam fora —
 * são infinitas e estão bloqueadas no robots. */
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGINAS.flatMap((p) => {
    const languages: Record<string, string> = {};
    for (const l of LOCALES) languages[l.htmlLang] = SITE_URL + localePath(l.code, p.path);
    languages["x-default"] = SITE_URL + localePath(DEFAULT_LOCALE, p.path);

    return LOCALES.map((l) => ({
      url: SITE_URL + localePath(l.code, p.path),
      lastModified: dia(maisRecente(p.data, IDIOMA_AO_AR[l.code])),
      changeFrequency: p.changeFrequency,
      priority: p.priority,
      alternates: { languages },
    }));
  });
}
