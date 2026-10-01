import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale } from "./app/i18n/config";

/**
 * Roteamento por idioma (ver `app/i18n/config.ts`).
 *
 * As páginas vivem em `app/[lang]/…`, mas o inglês — o idioma padrão — NÃO
 * leva prefixo na URL pública: `/roadmap` é reescrita por dentro para
 * `/en/roadmap`, e as URLs que o Google já indexa continuam as mesmas. Os
 * demais idiomas aparecem na URL (`/pt-br/roadmap`) e passam direto.
 *
 * `/en/…` digitado à mão é redirecionado para a URL sem prefixo: duas URLs
 * para a mesma página é conteúdo duplicado.
 *
 * Não há detecção automática por `Accept-Language` de propósito: mandar o
 * visitante para outro idioma sem ele pedir confunde quem compartilha links, e
 * o robô do Google (que não manda o cabeçalho) nunca veria as outras versões.
 * A troca é um clique no seletor de idioma do cabeçalho.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];

  if (first === DEFAULT_LOCALE) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(DEFAULT_LOCALE.length + 1) || "/";
    return NextResponse.redirect(url, 308);
  }

  if (isLocale(first)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // fora: API, interno do Next e arquivos com extensão (robots.txt, sitemap.xml,
  // llms.txt, icon.svg…) — nenhum deles tem versão por idioma
  // `[.]` e não `\.`: a barra invertida se perde na conversão do matcher do Next
  matcher: ["/((?!api/|_next/|.*[.].*|apple-icon).*)"],
};
