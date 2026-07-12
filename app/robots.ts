import type { MetadataRoute } from "next";
import { SITE_URL } from "./site";

/**
 * Permite indexar a landing e as páginas institucionais; bloqueia a varredura
 * das páginas de carteira (infinitas, dinâmicas e caras de gerar) e da API.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/how-it-works", "/roadmap"],
      disallow: ["/w/", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
