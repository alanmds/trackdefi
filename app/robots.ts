import type { MetadataRoute } from "next";
import { LOCALES, localePath } from "./i18n/config";
import { SITE_URL } from "./site";

/**
 * Permite indexar a landing e as páginas institucionais; bloqueia a varredura
 * das páginas de carteira (infinitas, dinâmicas e caras de gerar) e da API.
 * Vale para todos os idiomas: `/pt-br/w/` bloqueado junto com `/w/`.
 */
export default function robots(): MetadataRoute.Robots {
  const pages = ["/", "/how-it-works", "/roadmap", "/glossary"];
  return {
    rules: {
      userAgent: "*",
      allow: LOCALES.flatMap((l) => pages.map((p) => localePath(l.code, p))),
      disallow: [...LOCALES.map((l) => localePath(l.code, "/w/")), "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
