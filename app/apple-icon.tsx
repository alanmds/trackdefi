/**
 * Ícone do iOS/iPadOS — o que aparece quando alguém salva o site na tela de
 * início. Sem ele o Safari usa uma miniatura da página, que fica ilegível.
 *
 * É a mesma marca de `app/icon.svg` (os dois anéis do pool), só que em PNG
 * 180×180 e SEM canto arredondado: o próprio iOS aplica a máscara, e um raio
 * embutido apareceria duplicado.
 */

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#2e2013" }}>
        <svg width="180" height="180" viewBox="0 0 32 32">
          <circle cx="13" cy="16" r="7" fill="none" stroke="#ffdead" strokeWidth="2.6" />
          <circle cx="21" cy="16" r="7" fill="none" stroke="#7a9e7e" strokeWidth="2.6" opacity="0.9" />
        </svg>
      </div>
    ),
    size,
  );
}
