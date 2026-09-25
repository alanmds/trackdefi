"use client";

import { Analytics, type BeforeSend } from "@vercel/analytics/next";
import { OPT_OUT_KEY, optOutDecision, withoutOptOutParam } from "../analytics-optout";

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

export default function SiteAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
