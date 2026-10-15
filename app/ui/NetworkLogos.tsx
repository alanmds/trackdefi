"use client";

import { useEffect, useRef, useState } from "react";

/*
 * Faixa de logos das redes na home (15/10/2026, pedido do Alan): passar o
 * mouse numa rede mostra o nome dela e, logo abaixo, os logos das corretoras
 * que o trackdefi lê ali; passar o mouse num desses logos mostra o nome.
 *
 * - Um painel ÚNICO abaixo da faixa, e não um balão por logo: o balão perto da
 *   borda sairia da tela no celular.
 * - "Intenção de hover": com um painel já aberto, trocar de rede espera o
 *   mouse parar (120 ms). Sem isso, descer do logo até o painel cruzando a
 *   segunda linha de logos trocaria a rede no caminho.
 * - Toque e teclado: tocar/focar abre; tocar fora ou Esc fecha. Os logos das
 *   corretoras são focáveis, então o toque também mostra o nome.
 *
 * Os dados chegam prontos do servidor (app/site.ts: NETWORKS + COVERAGE).
 */

export interface NetworkLogo {
  name: string;
  slug: string;
  protocols: { name: string; slug: string }[];
}

const HOVER_INTENT_MS = 120;

export default function NetworkLogos({ networks, label }: { networks: NetworkLogo[]; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const hover = (i: number) => {
    cancel();
    if (active === null) setActive(i);
    else timer.current = setTimeout(() => setActive(i), HOVER_INTENT_MS);
  };

  // toque fora / Esc fecham
  useEffect(() => {
    if (active === null) return;
    const fora = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setActive(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [active]);

  useEffect(() => cancel, []);

  const net = active === null ? null : networks[active];

  return (
    <div
      className="netlogos"
      ref={root}
      onMouseLeave={() => {
        cancel();
        setActive(null);
      }}
    >
      <ul className="netlogos-row" aria-label={label}>
        {networks.map((n, i) => (
          <li key={n.slug}>
            <button
              type="button"
              className={`netlogo${active === i ? " is-active" : ""}`}
              aria-label={n.name}
              aria-expanded={active === i}
              aria-controls="netlogos-panel"
              onMouseEnter={() => hover(i)}
              onMouseLeave={cancel}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
            >
              <img src={`/logos/networks/${n.slug}.webp`} alt="" width={32} height={32} loading="lazy" />
            </button>
          </li>
        ))}
      </ul>

      <div id="netlogos-panel" className={`netlogos-panel${net ? " is-open" : ""}`} aria-live="polite">
        {net && (
          <div className="netlogos-card">
            <div className="netlogos-name">{net.name}</div>
            <ul className="netlogos-protocols">
              {net.protocols.map((p) => (
                <li key={p.slug}>
                  <button type="button" className="protologo" aria-label={p.name}>
                    <img src={`/logos/protocols/${p.slug}.webp`} alt="" width={28} height={28} loading="lazy" />
                    <span className="protologo-name" aria-hidden>
                      {p.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
