"use client";

import { useI18n } from "../i18n/provider";

/**
 * Botão dia/noite do cabeçalho. Sem escolha salva, o site segue o tema do
 * sistema (o CSS cuida disso sozinho); o clique grava a escolha oposta à que
 * está na tela e ela passa a valer em todas as páginas.
 *
 * O ícone certo é decidido pelo CSS (lua no dia, sol na noite), não pelo
 * React: assim o HTML do servidor é o mesmo para todos e não pisca.
 * O script que aplica a escolha salva antes da pintura está em THEME_SCRIPT.
 */
export const THEME_KEY = "trackdefi-theme";

/** roda no <head>, antes da pintura: sem ele a página abre clara e depois escurece */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

function isDarkNow(): boolean {
  const t = document.documentElement.dataset.theme;
  if (t === "dark" || t === "light") return t === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function ThemeToggle() {
  const { ui } = useI18n();

  function toggle() {
    const next = isDarkNow() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // navegação privada: vale só nesta página
    }
  }

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={ui.header.theme} title={ui.header.theme}>
      {/* lua: aparece no tema claro */}
      <svg className="ic-moon" viewBox="0 0 24 24" width="16" height="16" aria-hidden>
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" />
      </svg>
      {/* sol: aparece no tema escuro */}
      <svg className="ic-sun" viewBox="0 0 24 24" width="16" height="16" aria-hidden>
        <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </g>
      </svg>
    </button>
  );
}
