import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "../../../i18n/config";
import { getMessages } from "../../../i18n/get";
import { localeFrom, type LangParams } from "../../../i18n/server";
import { pageMetadata } from "../../../i18n/seo";
import { PAIRS_LISTED } from "../../../site";
import PairFinder from "../../../ui/PairFinder";

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const locale = await localeFrom(params);
  const m = getMessages(locale).pages.pairs;
  return {
    ...pageMetadata({ locale, path: "/tools/pairs", title: m.title, description: m.description }),
    ...(PAIRS_LISTED ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function PairsPage({ params }: LangParams) {
  const lang = await localeFrom(params);
  const { pages } = getMessages(lang);
  const m = pages.pairs;

  return (
    <main className="container prose pairs-page">
      <h1>{m.heading}</h1>
      <p className="prose-lede">{m.lede}</p>

      <PairFinder />

      <p className="prose-back">
        <Link href={localePath(lang, "/tools")} className="btn btn-ghost">
          {pages.simulator.back}
        </Link>
      </p>
    </main>
  );
}
