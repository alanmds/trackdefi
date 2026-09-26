/**
 * Textos que o visitante lê sobre a varredura e sobre preço ausente.
 *
 * Nasceu de uma queixa de 26/09/2026: a tela dizia "1 warning during the scan
 * — some data may be incomplete. Refresh to retry." para QUALQUER aviso, sem
 * dizer qual. Quem via um token sem preço (AA, na Robinhood) ao lado concluía
 * que era aquilo e que recarregar resolveria — e não resolve nunca.
 *
 * Duas regras daqui:
 * 1. Cada aviso diz O QUE aconteceu, e "Refresh to retry" só aparece quando
 *    tentar de novo ajuda de fato.
 * 2. Preço ausente não é erro do site: a fonte não cobre o token. A tela diz
 *    isso — a não ser que a fonte de preços tenha falhado nesta varredura,
 *    caso em que recarregar PODE resolver.
 */

import type { ScanNotice } from "../../core/service";
import { CHAINS } from "../../core/chains";
import { protocolLabel } from "./format";

function where(protocol: string, chainId: number): string {
  return `${protocolLabel(protocol)} on ${CHAINS[chainId]?.label ?? `chain ${chainId}`}`;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function noticeText(n: ScanNotice): { text: string; retry: boolean } {
  switch (n.kind) {
    case "source":
      return { text: `Couldn't read ${where(n.protocol, n.chainId)} — positions there are missing from this list.`, retry: true };
    case "partial":
      return { text: `Some data from ${where(n.protocol, n.chainId)} didn't load, so a position or reward may be missing.`, retry: true };
    case "locks":
      return { text: `Couldn't read governance locks on ${where(n.protocol, n.chainId)}.`, retry: true };
    case "prices":
      return { text: `The price service didn't answer for some tokens, so their dollar values show "—".`, retry: true };
    case "apr":
      return { text: `Pool APR data didn't load, so pool averages show "—".`, retry: true };
    case "fees":
      return {
        text:
          `Live fee measurement wasn't available for ${n.positions} ${plural(n.positions, "position", "positions")} — ` +
          `${plural(n.positions, "its", "their")} fee rate is estimated from pool-wide data where possible.`,
        retry: false,
      };
    case "capped":
      return {
        text: `This wallet holds a very large number of position NFTs on ${where(n.protocol, n.chainId)}; only ${n.checked.toLocaleString("en-US")} were checked.`,
        retry: false,
      };
    case "hooks":
      return {
        text:
          `${n.positions} ${where(n.protocol, n.chainId)} ${plural(n.positions, "position sits", "positions sit")} in a pool with a custom hook — ` +
          `any extra rewards the hook pays aren't counted.`,
        retry: false,
      };
  }
}

/** "AA", "AA and XYZ", "AA, XYZ and FOO" */
function listSymbols(symbols: string[]): string {
  const u = [...new Set(symbols)];
  if (u.length <= 1) return u[0] ?? "this token";
  return `${u.slice(0, -1).join(", ")} and ${u[u.length - 1]}`;
}

/** tooltip de qualquer "—" que venha de token sem preço */
export function noPriceTip(symbols: string[], pricesFailed: boolean): string {
  const quem = listSymbols(symbols);
  const it = new Set(symbols).size > 1 ? "them" : "it";
  return pricesFailed
    ? `No USD price for ${quem} right now — either our price source doesn't cover ${it}, or it didn't answer this time (see the warning above).`
    : `No reliable USD price for ${quem} — our price source doesn't cover ${it}, so ${it === "it" ? "it gets" : "they get"} no dollar value instead of a guess. This isn't an error; refreshing won't change it.`;
}

/** tooltip dos avisos de "sem preço" no topo da página */
export function noPriceSummaryTip(what: "positions" | "rewards", pricesFailed: boolean): string {
  const base =
    what === "positions"
      ? `These positions hold a token our price source doesn't cover, so they're left out of the total instead of guessed.`
      : `Some claimable tokens have no price in our price source, so they're left out of this total instead of guessed. The amounts are listed on each card.`;
  return pricesFailed
    ? `${base} The price service also failed to answer for some tokens this time — refreshing may bring those back.`
    : `${base} This isn't an error; refreshing won't change it.`;
}
