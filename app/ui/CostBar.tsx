"use client";

import { useState } from "react";
import { costLine } from "../custos";
import { DONATION_ADDRESS } from "../donate";
import { useI18n } from "../i18n/provider";

/** Faixa no topo de toda página: quanto o site já custou + endereço de apoio. */
export default function CostBar() {
  const { locale, ui } = useI18n();
  const [copied, setCopied] = useState(false);

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
    <aside className="costbar" aria-label={ui.costbar.aria}>
      <div className="container">
        <span>
          {costLine(locale, ui.costbar.line)} {ui.costbar.tips}
        </span>
        <code className="donate-addr" translate="no">
          <span className="costbar-full">{DONATION_ADDRESS}</span>
          <span className="costbar-short">
            {DONATION_ADDRESS.slice(0, 8)}…{DONATION_ADDRESS.slice(-6)}
          </span>
        </code>
        <button type="button" className="donate-copy" onClick={copy} aria-label={ui.costbar.copyAria}>
          {copied ? ui.costbar.copied : ui.costbar.copy}
        </button>
      </div>
    </aside>
  );
}
