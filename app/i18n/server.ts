import { notFound } from "next/navigation";
import { isLocale, type Locale } from "./config";

export type LangParams = { params: Promise<{ lang: string }> };

/** O idioma da rota, já validado — idioma fora da lista vira 404. SÓ NO SERVIDOR. */
export async function localeFrom(params: Promise<{ lang: string }>): Promise<Locale> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return lang;
}
