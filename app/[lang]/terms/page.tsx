import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "../../i18n/config";
import { getMessages } from "../../i18n/get";
import { basicTags, fill, rich, type Tags } from "../../i18n/rich";
import { localeFrom, type LangParams } from "../../i18n/server";
import { pageMetadata } from "../../i18n/seo";
import { SITE_NAME } from "../../site";
import { EDITADA_EM } from "../../sitemap-datas";
import { pageJsonLd } from "../../structured-data";
import { fmtDate } from "../../ui/format";

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const locale = await localeFrom(params);
  const m = getMessages(locale).pages.terms;
  return pageMetadata({ locale, path: "/terms", title: m.title, description: m.description });
}

/**
 * Termos de uso (15/11/2026). A data "Last updated" é a mesma do sitemap
 * (`EDITADA_EM.terms`), que `tests/sitemap.test.ts` obriga a acompanhar o
 * texto — então ela não envelhece calada.
 */
export default async function TermsPage({ params }: LangParams) {
  const lang = await localeFrom(params);
  const { pages, ui } = getMessages(lang);
  const m = pages.terms;
  const to = (path: string) => localePath(lang, path);
  const vars = { name: SITE_NAME };
  const tags: Tags = { ...basicTags, contact: (c) => <Link href={to("/contact")}>{c}</Link> };

  return (
    <main className="container prose">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd("WebPage", lang, "/terms", m.title, m.description)) }}
      />
      <h1>{m.title}</h1>
      <p className="prose-meta">{fill(m.updated, { date: fmtDate(EDITADA_EM.terms, ui.dates) })}</p>
      <p className="prose-lede">{rich(m.intro, basicTags, vars)}</p>

      {m.sections.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          <p>{rich(s.body, tags, vars)}</p>
        </section>
      ))}

      <p className="prose-back">
        <Link href={to("/")} className="btn">
          {pages.common.backToSearch}
        </Link>
      </p>
    </main>
  );
}
