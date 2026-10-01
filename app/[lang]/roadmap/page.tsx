import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "../../i18n/config";
import { getMessages, localizedChangelog } from "../../i18n/get";
import type { RoadmapItem, RoadmapKind } from "../../i18n/messages/en/pages";
import { basicTags, fill, rich } from "../../i18n/rich";
import { localeFrom, type LangParams } from "../../i18n/server";
import { pageMetadata } from "../../i18n/seo";
import { NETWORK_COUNT } from "../../site";
import { fmtDate } from "../../ui/format";

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const locale = await localeFrom(params);
  const m = getMessages(locale).pages.roadmap;
  /* o número de redes vem de NETWORK_COUNT: escrito à mão, ficou preso em
     "4 networks" e foi assim para o ar depois da Robinhood Chain. */
  return pageMetadata({
    locale,
    path: "/roadmap",
    title: m.title,
    description: fill(m.description, { count: NETWORK_COUNT }),
  });
}

function Status({ kind, label }: { kind: RoadmapKind; label: string }) {
  const className = kind === "live" ? "badge badge-good" : kind === "next" ? "badge badge-warn" : "badge";
  return <span className={className}>{label}</span>;
}

export default async function Roadmap({ params }: LangParams) {
  const lang = await localeFrom(params);
  const { ui, pages } = getMessages(lang);
  const m = pages.roadmap;
  const log = localizedChangelog(lang);

  const section = (kind: RoadmapKind, title: string, items: RoadmapItem[]) => (
    <>
      <h2>{title}</h2>
      <ul className="roadmap-list">
        {items.map((it) => (
          <li key={it.title}>
            <Status kind={kind} label={m.status[kind]} />
            <span>
              <strong>{it.title}</strong>
              {" — "}
              {rich(it.body, basicTags)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <main className="container prose">
      <h1>{m.heading}</h1>
      <p className="prose-lede">{rich(m.lede, basicTags)}</p>

      {section("live", m.liveTitle, m.live)}
      {section("next", m.nextTitle, m.next)}
      {section("planned", m.plannedTitle, m.planned)}
      {section("exploring", m.exploringTitle, m.exploring)}

      <h2>{m.neverTitle}</h2>
      <ul>
        {m.never.map((s) => (
          <li key={s}>{fill(s, { noToken: pages.noToken })}</li>
        ))}
      </ul>

      <p className="roadmap-updated">
        {rich(
          m.updated,
          { link: (c) => <Link href={localePath(lang, "/changelog")}>{c}</Link> },
          { date: fmtDate(log[0].date, ui.dates) },
        )}
      </p>

      <p className="prose-back">
        <Link href={localePath(lang, "/")} className="btn">
          {pages.common.backToSearch}
        </Link>
      </p>
    </main>
  );
}
