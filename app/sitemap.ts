import type { MetadataRoute } from "next";
import { CHANGELOG } from "./changelog";
import { SITE_URL } from "./site";

/**
 * Última mudança REAL de conteúdo de cada página (AAAA-MM-DD).
 *
 * ⚠️ Atualizar à mão quando o TEXTO da página mudar — não em todo deploy. Até
 * 27/09/2026 todas carimbavam a data do build: cada deploy dizia ao Google que
 * tudo tinha mudado, e um `lastmod` que muda sempre ele aprende a ignorar.
 * Não dá para tirar do git: a Vercel constrói sem o histórico completo.
 */
const EDITADA_EM = {
  home: "2026-09-26",
  howItWorks: "2026-09-25",
  roadmap: "2026-09-26",
  glossary: "2026-09-26",
} as const;

const dia = (d: string) => new Date(`${d}T12:00:00Z`);
/** home e roadmap exibem a data da última entrada do changelog — ela conta */
const comLog = (d: string) => dia(d > CHANGELOG[0].date ? d : CHANGELOG[0].date);

/** Sitemap das páginas indexáveis (páginas de carteira ficam fora — são
 * infinitas e estão bloqueadas no robots). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: comLog(EDITADA_EM.home), changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/how-it-works`, lastModified: dia(EDITADA_EM.howItWorks), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/roadmap`, lastModified: comLog(EDITADA_EM.roadmap), changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/glossary`, lastModified: dia(EDITADA_EM.glossary), changeFrequency: "monthly", priority: 0.6 },
    // a data da última entrada do log — é exatamente quando a página mudou
    { url: `${SITE_URL}/changelog`, lastModified: dia(CHANGELOG[0].date), changeFrequency: "weekly", priority: 0.6 },
  ];
}
