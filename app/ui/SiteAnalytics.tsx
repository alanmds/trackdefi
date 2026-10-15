"use client";

import { useEffect } from "react";
import { Analytics, type BeforeSend } from "@vercel/analytics/next";
import { OPT_OUT_KEY, optOutDecision, withoutOptOutParam } from "../analytics-optout";
import { CF_BEACON_SRC, cfBeaconConfig } from "../cf-analytics";

/*
 * Vercel Analytics com a porta de saída do dono (ver app/analytics-optout.ts).
 * Precisa ser componente de cliente: o `beforeSend` é uma função, e função
 * não atravessa do layout (servidor) para o navegador.
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

const beforeSend: BeforeSend = (event) => {
  const decision = optOutDecision(event.url, readFlag());
  if (decision.store) writeFlag(decision.store);
  return decision.send ? { ...event, url: withoutOptOutParam(event.url) } : null;
};

/** lido no build (NEXT_PUBLIC_): sem a variável, o script não existe */
const CF_CONFIG = cfBeaconConfig(process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN);

/**
 * Cloudflare Web Analytics (ver app/cf-analytics.ts). Entra uma vez por aba,
 * depois de ler a marca do dono — por isso via efeito, e não no HTML do
 * servidor, que não enxerga o localStorage.
 */
function CloudflareBeacon() {
  useEffect(() => {
    if (!CF_CONFIG || document.querySelector(`script[src="${CF_BEACON_SRC}"]`)) return;
    // grava a marca aqui também: não depender de a Vercel ter rodado antes
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

export default function SiteAnalytics() {
  return (
    <>
      <Analytics beforeSend={beforeSend} />
      <CloudflareBeacon />
    </>
  );
}
