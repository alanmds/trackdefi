import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "../../i18n/config";
import { getMessages, localizedChangelog } from "../../i18n/get";
import { fill, rich } from "../../i18n/rich";
import { localeFrom, type LangParams } from "../../i18n/server";
import { pageMetadata } from "../../i18n/seo";
import { NETWORK_COUNT, SITE_NAME } from "../../site";
import { fmtDate } from "../../ui/format";

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const locale = await localeFrom(params);
  const m = getMessages(locale).pages.changelog;
  return pageMetadata({
    locale,
    path: "/changelog",
    title: m.title,
    description: fill(m.description, { name: SITE_NAME, count: NETWORK_COUNT }),
  });
}

export default async function Changelog({ params }: LangParams) {
  const lang = await localeFrom(params);
  const { ui, pages } = getMessages(lang);
  const m = pages.changelog;

  return (
    <main className="container prose">
      <h1>{m.heading}</h1>
      <p className="prose-lede">{m.lede}</p>

      <ol className="changelog">
        {localizedChangelog(lang).map((e) => (
          <li className="changelog-entry" key={e.id}>
            <div className="changelog-meta">
              <time className="changelog-date" dateTime={e.date}>
                {fmtDate(e.date, ui.dates)}
              </time>
              <span className="badge">{m.kinds[e.kind]}</span>
            </div>
            <h2 className="changelog-title">{e.title}</h2>
            <p className="changelog-body">{e.body}</p>
          </li>
        ))}
      </ol>

      <p className="prose-note">
        {rich(m.note, { roadmap: (c) => <Link href={localePath(lang, "/roadmap")}>{c}</Link> })}
      </p>

      <p className="prose-back">
        <Link href={localePath(lang, "/")} className="btn">
          {pages.common.backToSearch}
        </Link>
      </p>
    </main>
  );
}
