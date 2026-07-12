import type { MetadataRoute } from "next";

/**
 * Permite indexar a landing e a página institucional; bloqueia a varredura
 * das páginas de carteira (infinitas, dinâmicas e caras de gerar) e da API.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/how-it-works", "/roadmap"],
      disallow: ["/w/", "/api/"],
    },
  };
}
