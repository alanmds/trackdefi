import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SearchForm from "../../ui/SearchForm";
import { LOCALE_CODES, localePath } from "../../i18n/config";
import { getMessages } from "../../i18n/get";
import { basicTags, fill, rich } from "../../i18n/rich";
import { localeFrom } from "../../i18n/server";
import { pageMetadata } from "../../i18n/seo";
import { humanList } from "../../site";
import { TRACKER_PAGES, trackerBySlug, trackerCoverage } from "../../trackers";

/**
 * Página de UMA corretora ("Uniswap position tracker"…). A lista, os slugs e
 * as regras estão em `app/trackers.ts`; os textos, em `pages.trackers`.
 *
 * O segmento é dinâmico só no nome: as páginas são geradas no build
 * (`generateStaticParams`) e qualquer outro caminho dá 404
 * (`dynamicParams = false`) — sem isso, toda URL inexistente do site cairia
 * aqui e custaria uma função.
 */
type Props = { params: Promise<{ lang: string; tracker: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALE_CODES.flatMap((lang) => TRACKER_PAGES.map((t) => ({ lang, tracker: t.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeFrom(params);
  const page = trackerBySlug((await params).tracker);
  if (!page) return {};
  const m = getMessages(locale).pages.trackers.pages[page.key];
  return pageMetadata({ locale, path: `/${page.slug}`, title: m.title, description: m.description });
}

export default async function TrackerPage({ params }: Props) {
  const lang = await localeFrom(params);
  const page = trackerBySlug((await params).tracker);
  if (!page) notFound();

  const { pages } = getMessages(lang);
  const c = pages.trackers.common;
  const m = pages.trackers.pages[page.key];
  const to = (path: string) => localePath(lang, path);

  /* FAQ visível + dados estruturados com o MESMO conteúdo (exigência do Google) */
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: m.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="container prose tracker-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <h1>{m.heading}</h1>
      <p className="prose-lede">{m.lede}</p>

      <div className="tracker-search">
        <SearchForm />
      </div>
      <p className="tracker-safe">{rich(c.safe, { link: (t) => <Link href={to("/how-it-works")}>{t}</Link> })}</p>

      <h2>{c.readsTitle}</h2>
      <ul>
        {m.reads.map((s) => (
          <li key={s}>{rich(s, basicTags)}</li>
        ))}
      </ul>

      {/* as redes saem de COVERAGE (app/site.ts) — nenhuma escrita à mão */}
      <h2>{fill(c.coverageTitle, { family: m.name })}</h2>
      <table className="tracker-coverage">
        <thead>
          <tr>
            <th scope="col">{c.coverageProtocol}</th>
            <th scope="col">{c.coverageNetworks}</th>
          </tr>
        </thead>
        <tbody>
          {trackerCoverage(page).map((row) => (
            <tr key={row.protocol}>
              <th scope="row">{row.protocol}</th>
              <td>{humanList(row.networks, "and", lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>{c.limitsTitle}</h2>
      <ul>
        {m.limits.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>

      <h2>{c.faqTitle}</h2>
      {m.faq.map((f) => (
        <details className="faq-item" key={f.q}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}

      <p className="tracker-safe">
        {rich(c.simulator, { link: (t) => <Link href={to("/tools/apr-simulator")}>{t}</Link> })}
      </p>

      <h2>{c.othersTitle}</h2>
      <ul className="tracker-others">
        {TRACKER_PAGES.filter((t) => t.key !== page.key).map((t) => (
          <li key={t.key}>
            <Link href={to(`/${t.slug}`)}>{pages.trackers.pages[t.key].heading}</Link>
          </li>
        ))}
      </ul>

      <p className="prose-back">
        <Link href={to("/")} className="btn">
          {pages.common.backToSearch}
        </Link>
      </p>
    </main>
  );
}
