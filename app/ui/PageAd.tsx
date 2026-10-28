"use client";

import { usePathname } from "next/navigation";
import { splitLocalePath } from "../i18n/config";
import { useI18n } from "../i18n/provider";
import AdSlot from "./AdSlot";

/**
 * O anúncio de TODA página: fica no layout, entre o conteúdo e o rodapé, então
 * página nova já nasce com anúncio sem ninguém lembrar de pôr.
 *
 * Exceção: a carteira (/w/…). Ela tem os próprios espaços (durante a varredura
 * e no fim da lista, em PositionsView), porque só ela sabe quando está em erro
 * ou vazia — e a regra é no máximo um anúncio visível por página.
 *
 * É componente de navegador só para ler o caminho; o HTML sai pronto do
 * servidor, então o robô da A-ADS vê o código na home como antes.
 */
export default function PageAd() {
  const { ui } = useI18n();
  const { path } = splitLocalePath(usePathname());
  if (/^\/w(\/|$)/.test(path)) return null;
  return (
    <div className="container">
      <AdSlot placement="page" label={ui.ads.label} />
    </div>
  );
}
