/**
 * Acesso aos dicionários — SÓ NO SERVIDOR (importa os textos de todas as
 * páginas, que são pesados). Componentes de navegador usam `useI18n()`
 * (`provider.tsx`), que recebe daqui apenas o recorte `ui` do idioma atual.
 *
 * Os dicionários são importados de forma estática: cada idioma novo entra no
 * pacote do servidor, nunca no do navegador, e o build falha se um arquivo
 * estiver faltando.
 */

import { CHANGELOG, type ChangeEntry } from "../changelog";
import type { Locale } from "./config";
import enPages from "./messages/en/pages";
import enUi from "./messages/en/ui";
import ptBrChangelog from "./messages/pt-br/changelog";
import ptBrPages from "./messages/pt-br/pages";
import ptBrUi from "./messages/pt-br/ui";

export type UiMessages = typeof enUi;
export type PagesMessages = typeof enPages;
export type ChangelogTranslations = Record<string, { title: string; body: string }>;

interface Bundle {
  ui: UiMessages;
  pages: PagesMessages;
  /** `null` no inglês: o texto original mora em `app/changelog.ts` */
  changelog: ChangelogTranslations | null;
}

const BUNDLES: Record<Locale, Bundle> = {
  en: { ui: enUi, pages: enPages, changelog: null },
  "pt-br": { ui: ptBrUi, pages: ptBrPages, changelog: ptBrChangelog },
};

export function getMessages(locale: Locale): Bundle {
  return BUNDLES[locale];
}

/** O log de atualizações no idioma pedido (cai no inglês se faltar tradução). */
export function localizedChangelog(locale: Locale): ChangeEntry[] {
  const tr = BUNDLES[locale].changelog;
  if (!tr) return CHANGELOG;
  return CHANGELOG.map((e) => (tr[e.id] ? { ...e, title: tr[e.id].title, body: tr[e.id].body } : e));
}
