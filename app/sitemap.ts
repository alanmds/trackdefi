import type { MetadataRoute } from "next";
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
  ];
}
