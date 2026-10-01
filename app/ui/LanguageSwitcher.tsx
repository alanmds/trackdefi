"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALES, localePath, splitLocalePath } from "../i18n/config";
import { useI18n } from "../i18n/provider";

/**
 * Seletor de idioma do cabeçalho: leva à MESMA página no outro idioma.
 *
 * Hoje são poucos idiomas, então vão todos à vista, em código curto (EN · PT)
 * com o nome por extenso no `title`. Quando a lista passar de uns quatro, vira
 * um menu suspenso — a lista vem de `LOCALES`, só a apresentação muda.
 */
export default function LanguageSwitcher() {
  const { locale, ui } = useI18n();
  const { path } = splitLocalePath(usePathname());

  return (
    <nav className="lang-switch" aria-label={ui.header.language}>
      {LOCALES.map((l) =>
        l.code === locale ? (
          <span key={l.code} className="lang-current" lang={l.htmlLang} title={l.native} aria-current="true">
            {l.short}
          </span>
        ) : (
          <Link key={l.code} href={localePath(l.code, path)} hrefLang={l.htmlLang} lang={l.htmlLang} title={l.native}>
            {l.short}
          </Link>
        ),
      )}
    </nav>
  );
}
