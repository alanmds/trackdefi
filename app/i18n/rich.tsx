import { Fragment, type ReactNode } from "react";
import type { Locale } from "./config";
import { localeInfo } from "./config";

/**
 * Ferramentas de texto dos dicionários — sem React de estado, servem tanto a
 * componentes de servidor quanto de navegador.
 *
 * Por que strings com marcadores, e não funções: o dicionário atravessa do
 * servidor para o navegador como DADO (props do provider), e função não
 * atravessa. Então tudo que varia vira marcador:
 *  - `{n}`, `{usd}`…         → valores, via `fill()`
 *  - `{ one, other, few… }`  → plural, via `pl()` (regras do `Intl.PluralRules`
 *                              do idioma — o russo e o árabe têm mais de duas formas)
 *  - `<b>…</b>`, `<link>…</link>` → trechos com formatação ou link, via `rich()`
 */

export type Vars = Record<string, string | number>;

/** Substitui `{nome}` pelos valores; marcador sem valor fica como está. */
export function fill(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Formas de plural de uma frase. `other` é obrigatória; o idioma pede as demais se precisar. */
export interface Plural {
  one: string;
  other: string;
  zero?: string;
  two?: string;
  few?: string;
  many?: string;
}

/** Escolhe a forma certa para `n` e preenche `{n}` (mais o que vier em `vars`). */
export function pl(locale: Locale, entry: Plural, n: number, vars?: Vars): string {
  const cat = new Intl.PluralRules(localeInfo(locale).intl).select(n);
  return fill(entry[cat] ?? entry.other, { n, ...vars });
}

export type Tags = Record<string, (children: ReactNode) => ReactNode>;

interface Frame {
  tag: string | null;
  children: ReactNode[];
}

/**
 * Transforma `"texto <b>forte</b> e <link>link</link>"` em nós React, usando
 * as funções de `tags` para cada marcador. Marcadores se aninham. Marcador
 * desconhecido ou mal fechado não quebra a página: o texto dele sai sem
 * formatação (e `tests/i18n.test.ts` pega o erro antes do deploy).
 */
export function rich(template: string, tags: Tags = {}, vars?: Vars): ReactNode {
  const src = fill(template, vars);
  const re = /<(\/?)([a-z][a-z0-9]*)>/gi;
  const stack: Frame[] = [{ tag: null, children: [] }];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;

  const close = () => {
    const f = stack.pop() as Frame;
    const parent = stack[stack.length - 1];
    const render = f.tag ? tags[f.tag] : undefined;
    const inner = f.children;
    parent.children.push(<Fragment key={key++}>{render ? render(inner) : inner}</Fragment>);
  };

  while ((m = re.exec(src))) {
    if (m.index > last) stack[stack.length - 1].children.push(src.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1] === "/") {
      // fecha o marcador aberto de mesmo nome; sem par, ignora
      if (stack.length > 1 && stack[stack.length - 1].tag === m[2]) close();
    } else {
      stack.push({ tag: m[2], children: [] });
    }
  }
  if (last < src.length) stack[stack.length - 1].children.push(src.slice(last));
  while (stack.length > 1) close();
  return <>{stack[0].children}</>;
}

/** O mesmo texto sem os marcadores — para JSON-LD, `title` e meta tags. */
export function stripTags(template: string, vars?: Vars): string {
  return fill(template, vars).replace(/<\/?[a-z][a-z0-9]*>/gi, "");
}

/** Marcadores comuns: negrito e itálico. */
export const basicTags: Tags = {
  b: (c) => <strong>{c}</strong>,
  em: (c) => <em>{c}</em>,
};
