"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { DONATION_ADDRESS } from "../donate";
import { useI18n } from "../i18n/provider";
import { usePhraseIndex } from "./donatePhrase";

/** /w/<endereço>, com ou sem prefixo de idioma (/pt-br/w/<endereço>) */
const WALLET_PAGE = /^(\/[a-z]{2}(-[a-z]{2})?)?\/w\//i;

/**
 * Faixa de apoio no topo da página de carteira — e só nela: é ali que o
 * visitante acabou de ver as próprias posições, o momento de maior gratidão.
 * Repete a frase sorteada pelo rodapé (app/ui/DonateLine.tsx), com o endereço.
 */
export default function CostBar() {
  const { ui } = useI18n();
  const pathname = usePathname();
  const index = usePhraseIndex();
  const [copied, setCopied] = useState(false);

  if (!WALLET_PAGE.test(pathname ?? "")) return null;
  const phrase = index === null ? null : ui.donate.phrases[index];

  async function copy() {
    try {
      await navigator.clipboard.writeText(DONATION_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponível — o endereço é selecionável com um clique */
    }
  }

  return (
    <aside className="costbar" aria-label={ui.donate.aria}>
      <div className="container">
        {/* antes do sorteio o espaço fica reservado, para a faixa não pular */}
        <span className="costbar-phrase">{phrase ?? " "}</span>
        <code className="donate-addr" translate="no">
          <span className="costbar-full">{DONATION_ADDRESS}</span>
          <span className="costbar-short">
            {DONATION_ADDRESS.slice(0, 8)}…{DONATION_ADDRESS.slice(-6)}
          </span>
        </code>
        <button type="button" className="donate-copy" onClick={copy} aria-label={ui.donate.copyAria}>
          {copied ? ui.donate.copied : ui.donate.copy}
        </button>
      </div>
    </aside>
  );
}
