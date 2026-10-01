"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "./config";
import type { UiMessages } from "./get";

/**
 * Entrega o idioma e os textos da interface aos componentes de navegador.
 * O servidor passa só `ui` (não as páginas), então o pacote que o visitante
 * baixa cresce pouco por idioma — e só carrega o idioma dele.
 */

export interface I18n {
  locale: Locale;
  ui: UiMessages;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ locale, ui, children }: { locale: Locale; ui: UiMessages; children: ReactNode }) {
  return <Ctx.Provider value={{ locale, ui }}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n fora do I18nProvider (veja app/[lang]/layout.tsx)");
  return v;
}
