import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "../../i18n/config";
import { getMessages } from "../../i18n/get";
import { basicTags, rich, type Tags } from "../../i18n/rich";
import { localeFrom, type LangParams } from "../../i18n/server";
import { pageMetadata } from "../../i18n/seo";
import { CONTACT_EMAIL, SITE_NAME, X_URL } from "../../site";
import { pageJsonLd } from "../../structured-data";

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const locale = await localeFrom(params);
  const m = getMessages(locale).pages.contact;
  return pageMetadata({ locale, path: "/contact", title: m.title, description: m.description });
}

/**
 * Contato (15/11/2026): e-mail, formulário e X. O formulário segue em
 * `/feedback` — esta página só reúne os caminhos e avisa que ninguém do site
 * pede chave (golpista se passa por suporte).
 */
export default async function ContactPage({ params }: LangParams) {
  const lang = await localeFrom(params);
  const { pages } = getMessages(lang);
  const m = pages.contact;
  const to = (path: string) => localePath(lang, path);
  const vars = { name: SITE_NAME, email: CONTACT_EMAIL };
  const tags: Tags = {
    ...basicTags,
    email: (c) => <a href={`mailto:${CONTACT_EMAIL}`}>{c}</a>,
    feedback: (c) => <Link href={to("/feedback")}>{c}</Link>,
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
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pageJsonLd("ContactPage", lang, "/contact", m.title, m.description)),
        }}
      />
      <h1>{m.title}</h1>
      <p className="prose-lede">{rich(m.lede, basicTags, vars)}</p>

      <ul>
        {m.channels.map((c) => (
          <li key={c}>{rich(c, tags, vars)}</li>
        ))}
      </ul>

      <h2>{m.safetyTitle}</h2>
      <p>{rich(m.safety, basicTags, vars)}</p>

      <p className="prose-back">
        <Link href={to("/")} className="btn">
          {pages.common.backToSearch}
        </Link>
      </p>
    </main>
  );
}
