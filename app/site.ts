/**
 * Identidade do site num LUGAR SÓ (estratégia anti-retrabalho de SEO):
 * quando o domínio definitivo e/ou o nome mudarem, editar AQUI (e setar
 * NEXT_PUBLIC_SITE_URL na Vercel) — todos os metadados, canonicals,
 * sitemap e dados estruturados se atualizam sozinhos. Ver SEO.md.
 */

export const SITE_NAME = "trackdefi";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://trackdefi.vercel.app").replace(/\/$/, "");

/** título da home (≤ 70 caracteres p/ não truncar no Google) */
export const SITE_TITLE = `${SITE_NAME} — Liquidity Pool Tracker · Aerodrome, Velodrome & Uniswap v3`;

/** descrição da home (~160 caracteres) */
export const SITE_DESCRIPTION =
  "Free LP tracker: paste a wallet address to see every Aerodrome, Velodrome & Uniswap v3 position across Base, Ethereum, Arbitrum & Optimism — staked included.";
