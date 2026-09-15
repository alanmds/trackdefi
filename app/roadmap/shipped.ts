/**
 * Datas de "no ar" do /roadmap.
 *
 * Mora fora do `page.tsx` porque arquivo de página no App Router só pode
 * exportar o que o Next espera (`default`, `metadata`...) — e porque assim dá
 * para testar, que é o ponto: o rodapé "Last updated" era escrito à mão e
 * envelhecia calado (ficou em "August 2026" depois do deploy de setembro).
 */

/**
 * Quando cada item FOI AO AR. Datas tiradas do histórico do git (o commit que
 * publicou, não o que escreveu), não de memória.
 */
export const SHIPPED = {
  earningNow: { since: "2026-07-24", updated: "2026-09-15" },
  baseAerodrome: { since: "2026-07-10" },
  baseUniswapV3: { since: "2026-07-11" },
  optimismVelodrome: { since: "2026-07-12" },
  uniswapV3Majors: { since: "2026-07-12" },
  robinhoodUniswapV3: { since: "2026-08-02" },
  superchainVelodrome: { since: "2026-08-10" },
  robinhoodUniswapV4: { since: "2026-08-10" },
} satisfies Record<string, { since: string; updated?: string }>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* Formatação à mão de propósito: `toLocaleDateString` depende do locale de
   quem renderiza, e a data sairia diferente no servidor e no navegador. */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** ISO ordena igual a cronologia, então o maior texto é a data mais recente. */
export const LAST_UPDATED: string = Object.values(SHIPPED)
  .flatMap((d) => ("updated" in d ? [d.since, d.updated] : [d.since]))
  .sort()
  .slice(-1)[0];
