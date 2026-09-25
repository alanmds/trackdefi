/** Formatação de números para a UI (site em inglês, locale en-US). */

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return usd2.format(n);
}

/** Quantidade de token: compacta bilhões de meme coins, preserva 4 casas úteis. */
export function fmtAmount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e9) return compact.format(n);
  if (abs >= 1) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: abs >= 1000 ? 2 : 4 }).format(n);
  }
  return new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4 }).format(n);
}

/** Preço de faixa: 6 dígitos significativos (mesma regra da CLI validada). */
export function fmtRangePrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n !== 0 && (Math.abs(n) >= 1e15 || Math.abs(n) < 1e-9)) return n.toExponential(2);
  return new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 }).format(n);
}

/**
 * Dólar de taxa ganha numa janela de medição.
 *
 * Numa janela de 15 min o valor costuma ser fração de centavo. `fmtUsd`
 * arredondaria para "$0.00" (parece defeito) e a precisão crua imprime
 * "$0.0000000006" (ruído que não ajuda ninguém a decidir nada). O meio-termo
 * honesto é dizer que é menos de um centavo — a taxa em % ao lado é que
 * carrega a informação nesse tamanho.
 */
export function fmtUsdFine(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n === 0) return "$0.00";
  if (Math.abs(n) >= 0.01) return fmtUsd(n);
  return n > 0 ? "< $0.01" : "> -$0.01";
}

/** duração da janela de medição: 900 → "15 min", 86400 → "24 h" */
export function fmtWindow(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  const h = sec / 3600;
  return `${h % 1 === 0 ? h : h.toFixed(1)} h`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Data em inglês a partir de ISO (AAAA-MM-DD): "15 Sep 2026".
 * Formatação à mão de propósito: `toLocaleDateString` depende do locale de
 * quem renderiza, e a data sairia diferente no servidor e no navegador.
 */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** unix segundos → "27 Aug 2026" (em UTC, igual no servidor e no navegador) */
export function fmtUnixDate(sec: number): string {
  return fmtDate(new Date(sec * 1000).toISOString().slice(0, 10));
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** percentual de APR: null → "—"; 2 casas até 10%, 1 casa acima */
export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("en-US", { maximumFractionDigits: Math.abs(n) < 10 ? 2 : 1 })}%`;
}

const PROTOCOL_LABELS: Record<string, string> = {
  aerodrome: "Aerodrome",
  velodrome: "Velodrome",
  "uniswap-v3": "Uniswap v3",
  "uniswap-v4": "Uniswap v4",
};

export function protocolLabel(id: string): string {
  return PROTOCOL_LABELS[id] ?? id;
}
