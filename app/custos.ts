import total from "./custos-total.json";
import type { Locale } from "./i18n/config";
import { localeInfo } from "./i18n/config";
import { pl, type Plural } from "./i18n/rich";

/**
 * Totais de custo e tempo do projeto, mostrados na faixa do topo de toda página.
 *
 * Os números vêm de `app/custos-total.json`, gerado por `npm run horas` a partir
 * da tabela privada (privado/custos.json). Não editar o JSON à mão: rodar o
 * script e commitar o arquivo. Valores já saem em dólares.
 */
export const COST_TOTALS: { horas: number; totalUsd: number; atualizadoEm: string } = total;

/** A frase (singular/plural) em inglês — o padrão das funções abaixo. */
const EN_LINE: Plural = {
  one: "So far this site has taken about {n} hour of work and US$ {usd} to build and run.",
  other: "So far this site has taken about {n} hours of work and US$ {usd} to build and run.",
};

/**
 * "So far this site has taken about 30 hours of work and US$ 445 to build and
 * run." — horas inteiras, dólar com o separador de milhar do idioma. A frase
 * do idioma vem do dicionário (`ui.costbar.line`).
 */
export function costLine(
  locale: Locale = "en",
  line: Plural = EN_LINE,
  t: { horas: number; totalUsd: number } = COST_TOTALS,
): string {
  const hours = Math.round(t.horas);
  return pl(locale, line, hours, { usd: t.totalUsd.toLocaleString(localeInfo(locale).intl) });
}
