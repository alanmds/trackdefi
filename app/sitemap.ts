import type { MetadataRoute } from "next";
import { CHANGELOG } from "./changelog";
import { SITE_URL } from "./site";

/** Sitemap das páginas indexáveis (páginas de carteira ficam fora — são
 * infinitas e estão bloqueadas no robots). Submeter ao Search Console SÓ
 * depois do domínio definitivo — ver SEO.md. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/roadmap`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/glossary`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    /* aqui o lastmod é VERDADE: a data da última entrada do log, não a do
       build. Ver PENDENCIAS.md — as outras três ainda carimbam o build. */
    {
      url: `${SITE_URL}/changelog`,
      lastModified: new Date(`${CHANGELOG[0].date}T12:00:00Z`),
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];
}
