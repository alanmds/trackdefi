import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fraunces, Inter } from "next/font/google";
import { COVERAGE, humanList, SITE_NAME, SITE_URL } from "../site";
import { isLocale, localeInfo, LOCALE_CODES, localePath, type Locale } from "../i18n/config";
import { getMessages } from "../i18n/get";
import { I18nProvider } from "../i18n/provider";
import { rich, basicTags } from "../i18n/rich";
import { siteDescription, siteKeywords, siteTitle } from "../i18n/seo";
import CostBar from "../ui/CostBar";
import DonateLine from "../ui/DonateLine";
import LanguageSwitcher from "../ui/LanguageSwitcher";
import SiteAnalytics from "../ui/SiteAnalytics";
import TapTips from "../ui/TapTips";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-fraunces" });

/** uma página estática por idioma; idioma fora da lista vira 404 */
export function generateStaticParams() {
  return LOCALE_CODES.map((lang) => ({ lang }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const title = siteTitle(lang);
  const description = siteDescription(lang);
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: `%s — ${SITE_NAME}`,
    },
    description,
    applicationName: SITE_NAME,
    /* O Safari do iPhone transforma sequência de dígitos em link de telefone —
       "NFT #1234567" virava um "ligar para…" azul no meio do card. Endereço e
       data também são detectados à toa em quantias e faixas de preço. */
    formatDetection: { telephone: false, address: false, date: false, email: false },
    /* as redes saem de NETWORK_NAMES: rede nova entra sozinha, e nenhuma fica
       de fora por esquecimento (a Robinhood Chain ficou, entre 02 e 06/08). */
    keywords: siteKeywords(lang),
    /* Os ícones ficam em app/ (fora de [lang]), então o Next não os anexa a
       este layout sozinho: declarados aqui. */
    icons: { icon: "/icon.svg", apple: "/apple-icon" },
    /* Padrão para páginas sem metadados próprios (ex.: /w/<endereço>, que o
       robots.txt já bloqueia). As páginas indexáveis montam o seu com
       pageMetadata() — sem `url` aqui, porque um og:url herdado apontaria toda
       página para a home. */
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      type: "website",
      locale: localeInfo(lang).ogLocale,
      images: [{ url: localePath(lang, "/opengraph-image"), width: 1200, height: 630 }],
    },
    twitter: {
      // large_image porque o card SEMPRE tem imagem
      card: "summary_large_image",
      title,
      description,
      images: [localePath(lang, "/opengraph-image")],
    },
    robots: { index: true, follow: true },
    /**
     * Prova de propriedade do domínio para o Base Dashboard
     * (`dashboard.base.org/apps/6a74c0ad80688a9243409bfa`), pedida no cadastro
     * do app em 06/08/2026 — Fase S5, Parte B. Sai como
     * `<meta name="base:app_id" content="…">` em toda página.
     *
     * NÃO é segredo: o valor existe justamente para ser lido no HTML público, e
     * fica no repo de propósito — assim ele viaja pelo git e não some numa
     * troca de computador, ao contrário do que é só de painel.
     *
     * ⚠️ Não remover sem conferir antes: se a Base revalidar o domínio e não
     * achar a tag, o app cai do cadastro.
     */
    other: { "base:app_id": "6a74c0ad80688a9243409bfa" },
  };
}

function websiteJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: SITE_URL + localePath(locale, "/"),
    description: siteDescription(locale),
    inLanguage: localeInfo(locale).htmlLang,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const info = localeInfo(lang);
  const { ui } = getMessages(lang);
  const f = ui.footer;
  const to = (path: string) => localePath(lang, path);

  return (
    <html lang={info.htmlLang} dir={info.rtl ? "rtl" : "ltr"} className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd(lang)) }}
        />
        <I18nProvider locale={lang} ui={ui}>
          <CostBar />
          <header className="site-header">
            <div className="container">
              <Link href={to("/")} className="brand">
                track<span className="tld">defi</span>
              </Link>
              <span className="header-note">
                <span className="dot-live" aria-hidden />
                {ui.header.readOnly}
              </span>
              <LanguageSwitcher />
            </div>
          </header>
          {children}
          <footer className="site-footer">
            <div className="container">
              {/* apoio voluntário: frase rotativa + endereço (app/donate.ts) */}
              <DonateLine />
              <span>
                {rich(
                  f.safety,
                  {
                    ...basicTags,
                    link: (c) => <Link href={to("/how-it-works")}>{c}</Link>,
                  },
                  { name: SITE_NAME },
                )}
              </span>
              <span>{f.disclaimer}</span>
              <span>
                {rich(
                  f.coverage,
                  {
                    roadmap: (c) => <Link href={to("/roadmap")}>{c}</Link>,
                    changelog: (c) => <Link href={to("/changelog")}>{c}</Link>,
                    glossary: (c) => <Link href={to("/glossary")}>{c}</Link>,
                  },
                  {
                    list: COVERAGE.map((c) => `${c.protocol} (${humanList(c.networks, "&", lang)})`).join(" · "),
                  },
                )}
              </span>
              <span>
                <Link href={to("/feedback")}>{f.feedback}</Link>
              </span>
            </div>
          </footer>
          {/* tooltips no toque: o iPhone não mostra `title` (app/ui/TapTips.tsx) */}
          <TapTips />
          {/* Vercel Analytics + saída do dono via ?notrack=1 (app/analytics-optout.ts) */}
          <SiteAnalytics />
        </I18nProvider>
      </body>
    </html>
  );
}
