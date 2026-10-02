/**
 * Formatação de números e datas para a UI, por idioma.
 *
 * Toda função recebe o idioma como ÚLTIMO argumento opcional; sem ele, sai em
 * inglês (en-US) — é o que os testes e o código antigo esperam. Quem formata
 * para o visitante (os componentes) passa o idioma da página.
 */

import { DEFAULT_LOCALE, localeInfo, type Locale } from "../i18n/config";

/* Um `Intl.NumberFormat` por idioma e por jeito de formatar: criar um a cada
   chamada, numa carteira com 40 posições, é desperdício. */
const cache = new Map<string, Intl.NumberFormat>();

function nf(locale: Locale, key: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const id = `${locale}|${key}`;
  let f = cache.get(id);
  if (!f) {
    f = new Intl.NumberFormat(localeInfo(locale).intl, opts);
    cache.set(id, f);
  }
  return f;
}

export function fmtUsd(n: number | null | undefined, locale: Locale = DEFAULT_LOCALE): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return nf(locale, "usd", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Quantidade de token: compacta bilhões de meme coins, preserva 4 casas úteis. */
export function fmtAmount(n: number, locale: Locale = DEFAULT_LOCALE): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e9) return nf(locale, "compact", { notation: "compact", maximumFractionDigits: 2 }).format(n);
  if (abs >= 1) {
    return nf(locale, abs >= 1000 ? "amt2" : "amt4", { maximumFractionDigits: abs >= 1000 ? 2 : 4 }).format(n);
  }
  return nf(locale, "sig4", { maximumSignificantDigits: 4 }).format(n);
}

/** Preço de faixa: 6 dígitos significativos (mesma regra da CLI validada). */
export function fmtRangePrice(n: number, locale: Locale = DEFAULT_LOCALE): string {
  if (!Number.isFinite(n)) return "—";
  if (n !== 0 && (Math.abs(n) >= 1e15 || Math.abs(n) < 1e-9)) return n.toExponential(2);
  return nf(locale, "sig6", { maximumSignificantDigits: 6 }).format(n);
}

/**
 * Distância do preço atual até uma borda da faixa, em % do preço atual — o
 * quanto o preço precisa andar para chegar ali (ex.: "−8.03%", "+32.48%").
 * Sinal sempre explícito: dentro da faixa a mínima fica abaixo (−) e a máxima
 * acima (+); fora dela, as duas ficam do mesmo lado, e o sinal mostra isso.
 * null = não dá para calcular (preço atual zero ou número inválido).
 * Faixa "inteira" (ticks extremos) dá números astronômicos: acima de
 * 999.999% vira ">+999,999%" em vez de um número sem sentido.
 */
export function fmtRangeDelta(bound: number, current: number, locale: Locale = DEFAULT_LOCALE): string | null {
  if (!Number.isFinite(bound) || !Number.isFinite(current) || current <= 0) return null;
  const pct = (bound / current - 1) * 100;
  if (!Number.isFinite(pct)) return null;
  const sep = (n: number) => nf(locale, "int", { maximumFractionDigits: 0 }).format(n);
  if (pct > 999_999) return `>+${sep(999_999)}%`;
  const abs = Math.abs(pct);
  const num = nf(locale, abs >= 1000 ? "pct0" : "pct2", {
    minimumFractionDigits: abs >= 1000 ? 0 : 2,
    maximumFractionDigits: abs >= 1000 ? 0 : 2,
  }).format(abs);
  if (num === nf(locale, "pct2", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(0)) {
    return `${num}%`;
  }
  return `${pct < 0 ? "−" : "+"}${num}%`;
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
export function fmtUsdFine(n: number | null | undefined, locale: Locale = DEFAULT_LOCALE): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n === 0) return fmtUsd(0, locale);
  if (Math.abs(n) >= 0.01) return fmtUsd(n, locale);
  const cent = fmtUsd(0.01, locale);
  return n > 0 ? `< ${cent}` : `> -${cent}`;
}

/** Rótulos de data e duração de um idioma (vêm do dicionário: `ui.dates`). */
export interface DateLabels {
  /** 12 meses abreviados */
  months: string[];
  /** `{d}` dia · `{m}` mês · `{y}` ano */
  format: string;
  /** `{n} min` */
  minutes: string;
  /** `{n} h` */
  hours: string;
}

/** O inglês mora aqui (e não só no dicionário) para as funções funcionarem sem ele. */
export const EN_DATE_LABELS: DateLabels = {
  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  format: "{d} {m} {y}",
  minutes: "{n} min",
  hours: "{n} h",
};

/** duração da janela de medição: 900 → "15 min", 86400 → "24 h" */
export function fmtWindow(sec: number, labels: DateLabels = EN_DATE_LABELS): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  if (sec < 3600) return labels.minutes.replace("{n}", String(Math.round(sec / 60)));
  const h = sec / 3600;
  return labels.hours.replace("{n}", String(h % 1 === 0 ? h : h.toFixed(1)));
}

/**
 * Data a partir de ISO (AAAA-MM-DD): "15 Sep 2026" / "15 set 2026".
 * Formatação à mão de propósito: `toLocaleDateString` depende do locale de
 * quem renderiza, e a data sairia diferente no servidor e no navegador. Os
 * nomes dos meses e a ordem vêm do dicionário do idioma.
 */
export function fmtDate(iso: string, labels: DateLabels = EN_DATE_LABELS): string {
  const [y, m, d] = iso.split("-");
  return labels.format
    .replace("{d}", String(Number(d)))
    .replace("{m}", labels.months[Number(m) - 1])
    .replace("{y}", y);
}

/** unix segundos → "27 Aug 2026" (em UTC, igual no servidor e no navegador) */
export function fmtUnixDate(sec: number, labels: DateLabels = EN_DATE_LABELS): string {
  return fmtDate(new Date(sec * 1000).toISOString().slice(0, 10), labels);
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** percentual de APR: null → "—"; 2 casas até 10%, 1 casa acima */
export function fmtPct(n: number | null | undefined, locale: Locale = DEFAULT_LOCALE): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const digits = Math.abs(n) < 10 ? 2 : 1;
  return `${nf(locale, `pct-max${digits}`, { maximumFractionDigits: digits }).format(n)}%`;
}

const PROTOCOL_LABELS: Record<string, string> = {
  aerodrome: "Aerodrome",
  velodrome: "Velodrome",
  "uniswap-v3": "Uniswap v3",
  "uniswap-v4": "Uniswap v4",
  "pancakeswap-v3": "PancakeSwap v3",
  "ramses-v3": "Ramses",
};

export function protocolLabel(id: string): string {
  return PROTOCOL_LABELS[id] ?? id;
}

/** número inteiro com separador de milhar do idioma ("1,000" / "1.000") */
export function fmtInt(n: number, locale: Locale = DEFAULT_LOCALE): string {
  return nf(locale, "int", { maximumFractionDigits: 0 }).format(n);
}

/** número com casas fixas ("2.3" / "2,3") */
export function fmtDecimal(n: number, digits: number, locale: Locale = DEFAULT_LOCALE): string {
  return nf(locale, `dec${digits}`, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}
