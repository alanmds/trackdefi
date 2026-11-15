import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "../../i18n/config";
import { getMessages } from "../../i18n/get";
import { basicTags, rich, type Tags } from "../../i18n/rich";
import { localeFrom, type LangParams } from "../../i18n/server";
import { pageMetadata } from "../../i18n/seo";
import { CONTACT_EMAIL, GITHUB_URL, SITE_NAME, X_URL } from "../../site";
import { pageJsonLd } from "../../structured-data";

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const locale = await localeFrom(params);
  const m = getMessages(locale).pages.about;
  return pageMetadata({ locale, path: "/about", title: m.title, description: m.description });
}

/** Quem está por trás do site (15/11/2026) — ver `pages.about`. */
export default async function AboutPage({ params }: LangParams) {
  const lang = await localeFrom(params);
  const { pages } = getMessages(lang);
  const m = pages.about;
  const to = (path: string) => localePath(lang, path);
  const vars = { name: SITE_NAME, noToken: pages.noToken, email: CONTACT_EMAIL };
  const tags: Tags = {
    ...basicTags,
    github: (c) => (
      <a href={GITHUB_URL} rel="me noopener">
        {c}
      </a>
    ),
    email: (c) => <a href={`mailto:${CONTACT_EMAIL}`}>{c}</a>,
    feedback: (c) => <Link href={to("/feedback")}>{c}</Link>,
    contact: (c) => <Link href={to("/contact")}>{c}</Link>,
    x: (c) => (
      <a href={X_URL} rel="me noopener">
        {c}
      </a>
    ),
  };

  return (
    <main className="container prose">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd("AboutPage", lang, "/about", m.title, m.description)) }}
      />
      <h1>{m.title}</h1>
      <p className="prose-lede">{rich(m.lede, basicTags, vars)}</p>

      {m.sections.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          <p>{rich(s.body, tags, vars)}</p>
        </section>
      ))}

      <h2>{m.contactTitle}</h2>
      <p>{rich(m.contact, tags, vars)}</p>

      <p className="prose-back">
        <Link href={to("/")} className="btn">
          {pages.common.backToSearch}
        </Link>
      </p>
    </main>
  );
}
