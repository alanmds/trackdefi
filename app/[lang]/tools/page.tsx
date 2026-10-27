import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "../../i18n/config";
import { getMessages } from "../../i18n/get";
import { localeFrom, type LangParams } from "../../i18n/server";
import { pageMetadata } from "../../i18n/seo";
import { PAIRS_LISTED, TOOLS_INDEXED } from "../../site";

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const locale = await localeFrom(params);
  const m = getMessages(locale).pages.tools;
  return {
    ...pageMetadata({ locale, path: "/tools", title: m.title, description: m.description }),
    ...(TOOLS_INDEXED ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function ToolsPage({ params }: LangParams) {
  const lang = await localeFrom(params);
  const { pages } = getMessages(lang);
  const m = pages.tools;

  return (
    <main className="container prose">
      <h1>{m.heading}</h1>
      <p className="prose-lede">{m.lede}</p>

      <ul className="tools-list">
        <li>
          <Link href={localePath(lang, "/tools/apr-simulator")} className="tools-item">
            <strong>{m.simulatorTitle}</strong>
            <span>{m.simulatorBody}</span>
          </Link>
        </li>
        {PAIRS_LISTED && (
          <li>
            <Link href={localePath(lang, "/tools/pairs")} className="tools-item">
              <strong>{m.pairsTitle}</strong>
              <span>{m.pairsBody}</span>
            </Link>
          </li>
        )}
      </ul>

      <p className="prose-back">
        <Link href={localePath(lang, "/")} className="btn">
          {pages.common.backToSearch}
        </Link>
      </p>
    </main>
  );
}
