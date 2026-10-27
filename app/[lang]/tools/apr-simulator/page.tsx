import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { localePath } from "../../../i18n/config";
import { getMessages } from "../../../i18n/get";
import { localeFrom, type LangParams } from "../../../i18n/server";
import { pageMetadata } from "../../../i18n/seo";
import { TOOLS_INDEXED } from "../../../site";
import AprSimulator from "../../../ui/AprSimulator";

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const locale = await localeFrom(params);
  const m = getMessages(locale).pages.simulator;
  return {
    ...pageMetadata({ locale, path: "/tools/apr-simulator", title: m.title, description: m.description }),
    ...(TOOLS_INDEXED ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function AprSimulatorPage({ params }: LangParams) {
  const lang = await localeFrom(params);
  const { pages } = getMessages(lang);
  const m = pages.simulator;

  return (
    <main className="container prose sim-page">
      <h1>{m.heading}</h1>
      <p className="prose-lede">{m.lede}</p>

      {/* lê ?pool= da URL — no Next, isso pede uma fronteira de Suspense */}
      <Suspense>
        <AprSimulator />
      </Suspense>

      <p className="prose-back">
        <Link href={localePath(lang, "/tools")} className="btn btn-ghost">
          {m.back}
        </Link>
      </p>
    </main>
  );
}
