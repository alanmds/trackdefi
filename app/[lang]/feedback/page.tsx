import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "../../i18n/config";
import { getMessages } from "../../i18n/get";
import { localeFrom, type LangParams } from "../../i18n/server";
import { pageMetadata } from "../../i18n/seo";
import FeedbackForm from "../../ui/FeedbackForm";

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const locale = await localeFrom(params);
  const m = getMessages(locale).pages.feedback;
  return pageMetadata({ locale, path: "/feedback", title: m.title, description: m.description });
}

export default async function FeedbackPage({ params }: LangParams) {
  const lang = await localeFrom(params);
  const { pages } = getMessages(lang);

  return (
    <main className="container prose">
      <h1>{pages.feedback.title}</h1>
      <p className="prose-lede">{pages.feedback.lede}</p>

      <FeedbackForm />

      <p className="prose-back">
        <Link href={localePath(lang, "/")} className="btn">
          {pages.common.backToSearch}
        </Link>
      </p>
    </main>
  );
}
