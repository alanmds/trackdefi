/**
 * Textos que o visitante lê sobre a varredura e sobre preço ausente.
 *
 * Nasceu de uma queixa de 26/09/2026: a tela dizia "1 warning during the scan
 * — some data may be incomplete. Refresh to retry." para QUALQUER aviso, sem
 * dizer qual. Quem via um token sem preço ao lado concluía
 * que era aquilo e que recarregar resolveria — e não resolve nunca.
 *
 * Duas regras daqui:
 * 1. Cada aviso diz O QUE aconteceu, e "Refresh to retry" só aparece quando
 *    tentar de novo ajuda de fato.
 * 2. Preço ausente não é erro do site: a fonte não cobre o token. A tela diz
 *    isso — a não ser que a fonte de preços tenha falhado nesta varredura,
 *    caso em que recarregar PODE resolver.
 *
 * As frases vêm do dicionário (`ui.notices`); toda função recebe o `I18n` da
 * página (`useI18n()`), e os testes passam o do inglês.
 */

import type { ScanNotice } from "../../core/service";
import { CHAINS } from "../../core/chains";
import { GRAMMAR } from "../i18n/config";
import { fill, pl } from "../i18n/rich";
import type { I18n } from "../i18n/provider";
import { fmtInt, protocolLabel } from "./format";

function where(i18n: I18n, protocol: string, chainId: number): string {
  return fill(i18n.ui.notices.where, {
    protocol: protocolLabel(protocol),
    network: CHAINS[chainId]?.label ?? fill(i18n.ui.common.chainFallback, { id: chainId }),
  });
}

export function noticeText(n: ScanNotice, i18n: I18n): { text: string; retry: boolean } {
  const { locale, ui } = i18n;
  const t = ui.notices;
  switch (n.kind) {
    case "source":
      return { text: fill(t.source, { where: where(i18n, n.protocol, n.chainId) }), retry: true };
    case "partial":
      return { text: fill(t.partial, { where: where(i18n, n.protocol, n.chainId) }), retry: true };
    case "locks":
      return { text: fill(t.locks, { where: where(i18n, n.protocol, n.chainId) }), retry: true };
    case "prices":
      return { text: t.prices, retry: true };
    case "apr":
      return { text: t.apr, retry: true };
    case "fees":
      return { text: pl(locale, t.fees, n.positions), retry: false };
    case "capped":
      return {
        text: fill(t.capped, { where: where(i18n, n.protocol, n.chainId), checked: fmtInt(n.checked, locale) }),
        retry: false,
      };
    case "hooks":
      return {
        text: pl(locale, t.hooks, n.positions, { where: where(i18n, n.protocol, n.chainId) }),
        retry: false,
      };
  }
}

/** "XYZ", "XYZ and ABC", "XYZ, ABC and FOO" */
function listSymbols(symbols: string[], i18n: I18n): string {
  const u = [...new Set(symbols)];
  if (u.length <= 1) return u[0] ?? i18n.ui.notices.thisToken;
  // mesmo conector do resto do site (`GRAMMAR` em i18n/config): "A, B e C"
  return `${u.slice(0, -1).join(", ")} ${GRAMMAR[i18n.locale].and} ${u[u.length - 1]}`;
}

/** tooltip de qualquer "—" que venha de token sem preço */
export function noPriceTip(symbols: string[], pricesFailed: boolean, i18n: I18n): string {
  const t = i18n.ui.notices;
  const many = new Set(symbols).size > 1;
  const vars = {
    who: listSymbols(symbols, i18n),
    them: many ? t.itMany : t.itOne,
    they: many ? t.getsMany : t.getsOne,
  };
  return fill(pricesFailed ? t.noPriceFailed : t.noPrice, vars);
}

/**
 * tooltip de um valor cujo preço veio do PRÓPRIO pool. Regra do Alan
 * (27/09/2026): o número é o do pool, mesmo distorcido — a tela só diz de
 * onde ele veio, sem esconder nem "corrigir".
 */
export function poolPriceTip(symbol: string, i18n: I18n): string {
  return fill(i18n.ui.notices.poolPrice, { symbol });
}

/** tooltip dos avisos de "sem preço" no topo da página */
export function noPriceSummaryTip(what: "positions" | "rewards", pricesFailed: boolean, i18n: I18n): string {
  const t = i18n.ui.notices;
  const base = what === "positions" ? t.summaryPositions : t.summaryRewards;
  return `${base} ${pricesFailed ? t.summaryFailed : t.summaryNotError}`;
}
