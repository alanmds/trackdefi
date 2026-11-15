"use client";

import { useEffect } from "react";
import { OPT_OUT_KEY, optOutDecision } from "../analytics-optout";
import { CF_BEACON_SRC, cfBeaconConfig } from "../cf-analytics";

/*
 * Contagem de visitas (Cloudflare Web Analytics) com a porta de saída do dono
 * (ver app/analytics-optout.ts). O Vercel Analytics saiu em 15/11/2026, com a
 * ida do site para a Hostinger: ele só funciona hospedado na Vercel.
 */

function readFlag(): string | null {
  try {
    return localStorage.getItem(OPT_OUT_KEY);
  } catch {
    return null; // armazenamento bloqueado: conta normalmente
  }
}

function writeFlag(action: "set" | "clear"): void {
  try {
    if (action === "set") localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    /* sem armazenamento, a marca não fica — nada a fazer */
  }
}

/** lido no build (NEXT_PUBLIC_): sem a variável, o script não existe */
const CF_CONFIG = cfBeaconConfig(process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN);

/**
 * Cloudflare Web Analytics (ver app/cf-analytics.ts). Entra uma vez por aba,
 * depois de ler a marca do dono — por isso via efeito, e não no HTML do
 * servidor, que não enxerga o localStorage.
 */
export default function SiteAnalytics() {
  useEffect(() => {
    if (!CF_CONFIG || document.querySelector(`script[src="${CF_BEACON_SRC}"]`)) return;
    const decision = optOutDecision(window.location.href, readFlag());
    if (decision.store) writeFlag(decision.store);
    if (!decision.send) return;
    const s = document.createElement("script");
    s.defer = true;
    s.src = CF_BEACON_SRC;
    s.dataset.cfBeacon = CF_CONFIG;
    document.body.appendChild(s);
  }, []);
  return null;
}
