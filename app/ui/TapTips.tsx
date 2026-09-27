"use client";

import { useEffect, useState } from "react";

/**
 * Tooltips para quem usa o dedo.
 *
 * O site explica muita coisa pelo atributo `title` (o tooltip do mouse): o
 * detalhamento do "Earning now", todo "—" de preço ausente, o status de um
 * lock. O Safari do iPhone NÃO mostra `title` — nem com toque, nem segurando.
 * Medido em 26/09/2026: 23 explicações por carteira sumiam para quase metade
 * dos visitantes (iOS).
 *
 * Em vez de reescrever cada tooltip, isto escuta o toque na página inteira:
 * em aparelho sem mouse (`hover: none`), tocar num elemento com `title` abre
 * o texto num balão fixo no pé da tela. No computador nada muda — o `title`
 * segue funcionando no mouse. Links e botões ficam de fora: tocar neles tem
 * de fazer o que sempre fizeram.
 */
export default function TapTips() {
  const [tip, setTip] = useState<string | null>(null);

  useEffect(() => {
    const semMouse = window.matchMedia("(hover: none)");

    /** devolve true quando o toque foi "usado" pelo balão (abriu ou fechou) */
    function decidir(alvo: Element | null): boolean {
      if (!alvo) return false;
      if (alvo.closest(".tap-tip-close")) {
        setTip(null);
        return true;
      }
      if (alvo.closest(".tap-tip")) return true; // toque no texto do balão não fecha
      const comTitulo = alvo.closest("main [title]");
      if (!comTitulo || comTitulo.closest("a, button, input, select, textarea, summary, label")) {
        setTip(null); // toque fora de qualquer explicação fecha o balão
        return false; // e o toque segue seu caminho: um link tem de abrir
      }
      const texto = comTitulo.getAttribute("title")?.trim();
      if (!texto) return false;
      setTip(texto);
      return true;
    }

    /* O dedo é lido direto (pointer "touch"), sem esperar o `click` que o
       Safari sintetiza depois — esse clique só vem se o elemento parecer
       clicável, e é um detalhe do navegador em que não dá para confiar
       sozinho. Dedo que se moveu é rolagem, não toque: não abre nada.

       CLIQUE FANTASMA (achado no WebKit em 26/09/2026): logo após o toque o
       Safari dispara um clique no MESMO ponto da tela. Se o "—" tocado está
       no pé da tela, o balão acabou de abrir exatamente ali — e o clique
       fantasma caía no × e o fechava na hora: o balão piscava e sumia. Ao
       fechar, o fantasma podia cair num link atrás do balão e abri-lo. Por
       isso, quando o toque foi do balão, o `touchend` é cancelado — é o que
       impede o navegador de gerar o clique. */
    let inicio: { x: number; y: number } | null = null;
    let ultimoToque = 0;
    let engolirClique = false;
    function onPointerDown(e: PointerEvent) {
      inicio = e.pointerType === "touch" ? { x: e.clientX, y: e.clientY } : null;
      engolirClique = false;
    }
    function onPointerUp(e: PointerEvent) {
      if (e.pointerType !== "touch" || !inicio || !semMouse.matches) return;
      const moveu = Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 10;
      inicio = null;
      if (moveu) return;
      ultimoToque = Date.now();
      engolirClique = decidir(e.target as Element | null);
    }
    function onTouchEnd(e: TouchEvent) {
      if (engolirClique && e.cancelable) e.preventDefault();
      engolirClique = false;
    }
    function onPointerCancel() {
      inicio = null; // o navegador assumiu o gesto (rolagem, zoom)
      engolirClique = false;
    }
    function onClick(e: MouseEvent) {
      // o clique que o Safari sintetiza logo após o toque já foi tratado acima
      if (!semMouse.matches || Date.now() - ultimoToque < 800) return;
      decidir(e.target as Element | null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setTip(null);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerCancel);
    // passive: false — sem isso o navegador ignora o preventDefault
    document.addEventListener("touchend", onTouchEnd, { passive: false });
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerCancel);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!tip) return null;
  return (
    <div className="tap-tip" role="status">
      <p>{tip}</p>
      <button type="button" className="tap-tip-close" aria-label="Close" onClick={() => setTip(null)}>
        ×
      </button>
    </div>
  );
}
