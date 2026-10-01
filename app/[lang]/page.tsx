import type { Metadata } from "next";
import Link from "next/link";
import SearchForm from "../ui/SearchForm";
import { fmtDate } from "../ui/format";
import { localePath } from "../i18n/config";
import { getMessages, localizedChangelog } from "../i18n/get";
import { basicTags, fill, rich, stripTags } from "../i18n/rich";
import { localeFrom, type LangParams } from "../i18n/server";
import { pageMetadata } from "../i18n/seo";
import { COVERAGE, coverageSentence, DEMO_WALLET, humanList, networksOf, networksSentence, SITE_NAME } from "../site";

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  return pageMetadata({ locale: await localeFrom(params), path: "/" });
}

export default async function Home({ params }: LangParams) {
  const lang = await localeFrom(params);
  const { ui, pages } = getMessages(lang);
  const h = pages.home;
  const latest = localizedChangelog(lang)[0];
  const to = (path: string) => localePath(lang, path);

  /* FAQ visível abaixo + dados estruturados correspondentes (mesmo conteúdo,
     exigência do Google). Perguntas = intenções reais de busca do público-alvo.
     Os valores que variam (redes, cobertura) saem de app/site.ts. */
  const faqVars = {
    name: SITE_NAME,
    networks: networksSentence("and", lang),
    velodromeNetworks: humanList(networksOf("Velodrome"), "and", lang),
    coverage: coverageSentence(lang),
    noToken: pages.noToken,
  };
  const faq = h.faq.map((f) => ({ q: fill(f.q, faqVars), a: fill(f.a, faqVars) }));
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: stripTags(f.q),
      acceptedAnswer: { "@type": "Answer", text: stripTags(f.a) },
    })),
  };

  return (
    <main className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <section className="hero">
        <h1>
          {h.heading[0]}
          <br />
          {h.heading[1]}
        </h1>
        <p className="lede">{fill(h.lede, { networks: faqVars.networks })}</p>
        <SearchForm autoFocus />
        <p className="try-demo">
          {rich(h.tryDemo, { link: (c) => <Link href={to(`/w/${DEMO_WALLET}`)}>{c}</Link> })}
        </p>
        {/* sinal de que o site está vivo: a última mudança, datada, na página
            que todo mundo vê. Sai de app/changelog.ts — nada escrito à mão. */}
        <p className="whats-new">
          {rich(
            h.whatsNew,
            {
              date: (c) => <span className="whats-new-date">{c}</span>,
              link: (c) => <Link href={to("/changelog")}>{c}</Link>,
            },
            { date: fmtDate(latest.date, ui.dates), title: latest.title },
          )}
        </p>
        <div className="coverage">
          {COVERAGE.map((c) => (
            <span className="chip" key={c.protocol}>
              {c.protocol} · {humanList(c.networks, "&", lang)}
            </span>
          ))}
          <Link href={to("/roadmap")} className="chip">
            {rich(h.more, { soon: (c) => <span className="soon">{c}</span> })}
          </Link>
        </div>
      </section>

      <section className="features" aria-label={h.featuresAria}>
        {h.features.map((f) => (
          <div className="feature" key={f.title}>
            <h3>{f.title}</h3>
            <p>{fill(f.body, { name: SITE_NAME })}</p>
          </div>
        ))}
      </section>

      <section className="faq" aria-label={h.faqAria}>
        <h2>{h.faqTitle}</h2>
        {faq.map((f) => (
          <details className="faq-item" key={f.q}>
            <summary>{f.q}</summary>
            <p>{rich(f.a, basicTags)}</p>
          </details>
        ))}
      </section>
    </main>
  );
}
