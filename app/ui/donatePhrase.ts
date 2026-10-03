"use client";

import { useSyncExternalStore } from "react";

/**
 * A frase de doação sorteada para a página atual, compartilhada entre o rodapé
 * (DonateLine, que faz o sorteio) e a faixa do topo da página de carteira
 * (CostBar, que só lê). Um sorteio por página: se cada componente sorteasse a
 * sua, a fila andaria duas casas por visita e as duas frases seriam diferentes.
 */
let current: number | null = null;
const listeners = new Set<() => void>();

export function setPhraseIndex(index: number) {
  current = index;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePhraseIndex(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
