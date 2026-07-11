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

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
