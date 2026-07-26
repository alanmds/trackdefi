/**
 * Card de compartilhamento (o que aparece ao colar o link no X, Discord,
 * Telegram, WhatsApp). Gerado pelo Next em tempo de BUILD — é um PNG estático,
 * não custa nada em produção.
 *
 * Regras do gerador (Satori, não é um navegador):
 * - só flexbox (nada de grid/float) e todo elemento com mais de um filho
 *   precisa de `display: flex` EXPLÍCITO;
 * - a fonte é a padrão do next/og. As do site (Inter/Fraunces) exigiriam
 *   baixar o arquivo .ttf no build — dependência de rede que não vale o ganho
 *   num card de 1200×630.
 *
 * A paleta e a marca são as mesmas de `app/globals.css` e `app/icon.svg`: quem
 * vê o card e depois abre o site reconhece o mesmo lugar.
 */

import { ImageResponse } from "next/og";
import { SITE_NAME } from "./site";

export const alt = `${SITE_NAME} — liquidity pool tracker`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#ffdead";
const INK = "#2e2013";
const INK_SOFT = "#6b5333";
const ACCENT = "#7a4a10";
const GOOD = "#1e7a46";
const RING = "#7a9e7e";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: "68px 76px",
          color: INK,
        }}
      >
        {/* marca: os dois anéis do favicon + o wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <svg width="76" height="76" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill={INK} />
            <circle cx="13" cy="16" r="7" fill="none" stroke={BG} strokeWidth="2.6" />
            <circle cx="21" cy="16" r="7" fill="none" stroke={RING} strokeWidth="2.6" opacity="0.9" />
          </svg>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 700, letterSpacing: "-0.02em" }}>
            <span>track</span>
            <span style={{ color: ACCENT }}>defi</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 78, fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.03em" }}>
            Liquidity Pool Tracker
          </div>
          <div style={{ marginTop: 24, fontSize: 36, lineHeight: 1.35, color: INK_SOFT }}>
            Paste a wallet address — see every LP position, staked ones included.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: INK }}>
            Aerodrome · Velodrome · Uniswap v3
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 27, color: INK_SOFT }}>
            <div style={{ width: 16, height: 16, borderRadius: 8, background: GOOD }} />
            <div style={{ display: "flex" }}>Base · Optimism · Ethereum · Arbitrum — read-only, no keys, no login</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
