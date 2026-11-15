/**
 * Dados estruturados (JSON-LD, schema.org) do site inteiro — SÓ NO SERVIDOR.
 *
 * Até 15/11/2026 o layout publicava só um `WebApplication`. Agentes de IA e
 * buscadores procuram também QUEM está por trás (Organization, com contato e
 * os perfis oficiais em `sameAs`) e o que o site é (WebSite, com a busca por
 * carteira como `SearchAction`). Os nós se ligam por `@id`, num `@graph`.
 *
 * Tudo sai de `app/site.ts` — e-mail, perfis e endereço do site num lugar só.
 */

import { localeInfo, LOCALES, localePath, type Locale } from "./i18n/config";
import { siteDescription } from "./i18n/seo";
import { CONTACT_EMAIL, SAME_AS, SITE_NAME, SITE_URL } from "./site";

export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const APP_ID = `${SITE_URL}/#webapp`;

export function organizationNode(locale: Locale) {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-icon` },
    description: siteDescription(locale),
    email: CONTACT_EMAIL,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: CONTACT_EMAIL,
        url: SITE_URL + localePath(locale, "/contact"),
        availableLanguage: LOCALES.map((l) => l.htmlLang),
      },
    ],
    sameAs: [...SAME_AS],
  };
}

export function siteJsonLd(locale: Locale) {
  const home = SITE_URL + localePath(locale, "/");
  const lang = localeInfo(locale).htmlLang;
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(locale),
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: SITE_NAME,
        url: home,
        inLanguage: lang,
        publisher: { "@id": ORG_ID },
        // a busca do site é por endereço de carteira: /w/<endereço>
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}${localePath(locale, "/w/")}{wallet_address}` },
          "query-input": "required name=wallet_address",
        },
      },
      {
        "@type": "WebApplication",
        "@id": APP_ID,
        name: SITE_NAME,
        url: home,
        description: siteDescription(locale),
        inLanguage: lang,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": ORG_ID },
      },
    ],
  };
}

/** página institucional (AboutPage, ContactPage, WebPage) ligada à organização */
export function pageJsonLd(
  type: "AboutPage" | "ContactPage" | "WebPage",
  locale: Locale,
  path: string,
  name: string,
  description: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": type,
    name,
    description,
    url: SITE_URL + localePath(locale, path),
    inLanguage: localeInfo(locale).htmlLang,
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": ORG_ID },
    ...(type === "ContactPage" ? { mainEntity: { "@id": ORG_ID } } : {}),
  };
}
