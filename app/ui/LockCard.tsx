"use client";

import type { LockDTO } from "../../core/service";
import { CHAINS } from "../../core/chains";
import { fill } from "../i18n/rich";
import { useI18n } from "../i18n/provider";
import { fmtAmount, fmtUnixDate, fmtUsd, protocolLabel } from "./format";

/**
 * Card de um lock de governança (veAERO / veVELO).
 *
 * Mesma família visual do `PositionCard` (mesmas classes), mas conteúdo
 * próprio: um token só, poder de voto e o estado do lock. O estado é a
 * informação mais útil do card — um lock VENCIDO continua segurando o token,
 * mas já pode ser sacado, e nenhum agregador que comparamos avisa isso.
 */
export default function LockCard({ l }: { l: LockDTO }) {
  const { locale, ui } = useI18n();
  const t = ui.lock;
  const chain = CHAINS[l.chainId];
  const veSymbol = `ve${l.token.symbol}`;
  const usd = (n: number | null) => fmtUsd(n, locale);
  const amount = (n: number) => fmtAmount(n, locale);
  const date = fmtUnixDate(l.expiresAt, ui.dates);

  let status: { label: string; cls: string; tip: string };
  if (l.managedId) {
    status = { label: fill(t.managed, { id: l.managedId }), cls: "badge", tip: t.managedTip };
  } else if (l.permanent) {
    status = { label: t.permanent, cls: "badge", tip: t.permanentTip };
  } else if (l.expired) {
    status = { label: t.expired, cls: "badge badge-warn", tip: fill(t.expiredTip, { date }) };
  } else {
    status = { label: fill(t.unlocks, { date }), cls: "badge", tip: t.unlocksTip };
  }

  return (
    <article className="pos-card">
      <div className="pos-head">
        <h3 className="pos-title">
          {veSymbol} #{l.lockId}
        </h3>
        <span className="pos-value">{usd(l.valueUsd)}</span>
      </div>

      <div className="badges">
        <span className="badge">{chain?.label ?? fill(ui.common.chainFallback, { id: l.chainId })}</span>
        <span className="badge">{protocolLabel(l.protocol)}</span>
        <span className="badge">{t.badge}</span>
        <span className={status.cls} title={status.tip}>
          {status.label}
        </span>
      </div>

      <div className="token-rows">
        <div className="token-row">
          <span className="sym">{fill(t.locked, { symbol: l.token.symbol })}</span>
          <span className="amt">
            {amount(l.token.amount)} <span className="usd">{usd(l.valueUsd)}</span>
          </span>
        </div>
        <div className="token-row" title={t.votingPowerTip}>
          <span className="sym">{t.votingPower}</span>
          <span className="amt">
            {amount(l.votingPower)} <span className="usd">{veSymbol}</span>
          </span>
        </div>
      </div>

      {l.rewards.length > 0 && (
        <div>
          <div className="subhead">{t.claimable}</div>
          <div className="token-rows">
            {l.rewards.map((r, i) => (
              <div
                className="token-row"
                key={`${r.address}-${r.kind}-${i}`}
                title={r.kind === "rebase" ? t.rebaseTip : t.votesTip}
              >
                <span className="sym">
                  {r.symbol} <span className="usd">{r.kind === "rebase" ? t.rebase : t.votes}</span>
                </span>
                <span className="amt">
                  {amount(r.amount)} <span className="usd">{r.valueUsd !== null ? usd(r.valueUsd) : "—"}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="rewards-total">
            <span>{t.totalClaimable}</span>
            <span>{usd(l.rewardsUsd)}</span>
          </div>
        </div>
      )}
    </article>
  );
}
