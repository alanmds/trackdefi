import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "../../i18n/config";
import { getMessages } from "../../i18n/get";
import { basicTags, rich } from "../../i18n/rich";
import { localeFrom, type LangParams } from "../../i18n/server";
import { pageMetadata } from "../../i18n/seo";
import { coverageSentence } from "../../site";

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const locale = await localeFrom(params);
  const m = getMessages(locale).pages.howItWorks;
  /* sem citar redes na descrição: a lista muda a cada expansão e a descrição
     envelhece sozinha (foi o que aconteceu — dizia "the Base blockchain"
     quando já eram quatro redes). */
  return pageMetadata({ locale, path: "/how-it-works", title: m.title, description: m.description });
}

export default async function HowItWorks({ params }: LangParams) {
  const lang = await localeFrom(params);
  const { pages } = getMessages(lang);
  const m = pages.howItWorks;

  return (
    <main className="container prose">
      <h1>{m.title}</h1>

      <p className="prose-lede">{m.lede}</p>

      <h2>{m.safeTitle}</h2>
      <ul>
        {m.safe.map((s) => (
          <li key={s}>{rich(s, basicTags)}</li>
        ))}
      </ul>

      <h2>{m.howTitle}</h2>
      <ol>
        {m.how.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>

      <h2>{m.notTitle}</h2>
      <ul>
        {m.not.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>

      <h2>{m.coverageTitle}</h2>
      <p>
        {rich(
          m.coverage,
          { roadmap: (c) => <Link href={localePath(lang, "/roadmap")}>{c}</Link> },
          { coverage: coverageSentence(lang) },
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
