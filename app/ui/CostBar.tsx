"use client";

import { useState } from "react";
import { costLine } from "../custos";
import { DONATION_ADDRESS } from "../donate";

/** Faixa no topo de toda página: quanto o site já custou + endereço de apoio. */
export default function CostBar() {
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
    <aside className="costbar" aria-label="Cost of building trackdefi">
      <div className="container">
        <span>{costLine()} Tips are optional:</span>
        <code className="donate-addr" translate="no">
          <span className="costbar-full">{DONATION_ADDRESS}</span>
          <span className="costbar-short">
            {DONATION_ADDRESS.slice(0, 8)}…{DONATION_ADDRESS.slice(-6)}
          </span>
        </code>
        <button type="button" className="donate-copy" onClick={copy} aria-label="Copy tip address">
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </aside>
  );
}
