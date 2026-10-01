import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { localePath } from "../../i18n/config";
import { getMessages } from "../../i18n/get";
import { basicTags, rich, type Tags } from "../../i18n/rich";
import { localeFrom, type LangParams } from "../../i18n/server";
import { pageMetadata } from "../../i18n/seo";
import { COVERAGE, humanList, networksSentence } from "../../site";

/**
 * Glossário: o que é cada informação que a página de carteira mostra.
 *
 * Nasceu em 26/09/2026 de uma pergunta do Alan olhando um card ("o que é cada
 * coisa aqui?"). A ordem segue a da TELA, de cima para baixo — quem chega aqui
 * está com uma carteira aberta na outra aba procurando um rótulo.
 *
 * O TEXTO mora nos dicionários (`app/i18n/messages/<idioma>/pages.ts`, chave
 * `glossary`); aqui só a montagem. Os termos têm de ser IGUAIS aos rótulos da
 * tela, em cada idioma.
 *
 * ⚠️ Manter em dia: rótulo novo ou renomeado em `app/ui/` (PositionsView,
 * PositionCard, LockCard, RangeBar, notices.ts) tem de entrar aqui também —
 * em TODOS os idiomas. E a regra do `app/site.ts` vale: nome de rede NUNCA à
 * mão — sai de `NETWORKS`.
 */

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const locale = await localeFrom(params);
  const m = getMessages(locale).pages.glossary;
  return pageMetadata({ locale, path: "/glossary", title: m.title, description: m.description });
}

export default async function Glossary({ params }: LangParams) {
  const lang = await localeFrom(params);
  const { pages } = getMessages(lang);
  const g = pages.glossary;
  const to = (path: string) => localePath(lang, path);

  const vars = {
    networks: networksSentence("and", lang),
    exchanges: humanList(
      COVERAGE.map((c) => c.protocol),
      "and",
      lang,
    ),
  };
  /* links internos do glossário: âncoras dentro da própria página */
  const tags: Tags = {
    ...basicTags,
    dash: (c: ReactNode) => <a href="#dash">{c}</a>,
    lock: (c: ReactNode) => <a href="#governance-lock">{c}</a>,
    range: (c: ReactNode) => <a href="#price-range">{c}</a>,
  };

  return (
    <main className="container prose">
      <h1>{g.heading}</h1>

      <p className="prose-lede">{g.lede}</p>

      <nav className="glossary-toc" aria-label={g.tocAria}>
        {g.sections.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            {s.title}
          </a>
        ))}
      </nav>

      {g.sections.map((s) => (
        <section key={s.id} id={s.id} className="glossary-section">
          <h2>{s.title}</h2>
          {s.intro && <p>{rich(s.intro, tags, vars)}</p>}
          <dl className="glossary">
            {s.terms.map((t) => (
              <div key={t.id} id={t.id} className="glossary-item">
                <dt>{t.term}</dt>
                <dd>
                  {rich(t.def, tags, vars)}
                  {t.list && (
                    <ul>
                      {t.list.map((li) => (
                        <li key={li}>{rich(li, tags, vars)}</li>
                      ))}
                    </ul>
                  )}
                  {t.after && rich(t.after, tags, vars)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <p className="prose-note">
        {rich(g.note, { how: (c) => <Link href={to("/how-it-works")}>{c}</Link> })}
      </p>

      <p className="prose-back">
        <Link href={to("/")} className="btn">
          {pages.common.backToSearch}
        </Link>
      </p>
    </main>
  );
}
