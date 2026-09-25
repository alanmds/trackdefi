import type { LockDTO } from "../../core/service";
import { CHAINS } from "../../core/chains";
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
  const chain = CHAINS[l.chainId];
  const veSymbol = `ve${l.token.symbol}`;

  let status: { label: string; cls: string; tip: string };
  if (l.managedId) {
    status = {
      label: `In managed lock #${l.managedId}`,
      cls: "badge",
      tip: "This lock was deposited into a managed lock (a relay). The tokens now live in that managed lock, so this one shows zero locked.",
    };
  } else if (l.permanent) {
    status = {
      label: "Permanent lock",
      cls: "badge",
      tip: "Permanently locked: voting power does not decay and there is no unlock date.",
    };
  } else if (l.expired) {
    status = {
      label: "⚠ Expired — withdrawable",
      cls: "badge badge-warn",
      tip: `This lock expired on ${fmtUnixDate(l.expiresAt)}. The tokens are still in it, but they can be withdrawn — and it no longer has voting power.`,
    };
  } else {
    status = {
      label: `Unlocks ${fmtUnixDate(l.expiresAt)}`,
      cls: "badge",
      tip: "Voting power decays linearly until this date, when the tokens can be withdrawn.",
    };
  }

  return (
    <article className="pos-card">
      <div className="pos-head">
        <h3 className="pos-title">
          {veSymbol} #{l.lockId}
        </h3>
        <span className="pos-value">{fmtUsd(l.valueUsd)}</span>
      </div>

      <div className="badges">
        <span className="badge">{chain?.label ?? `chain ${l.chainId}`}</span>
        <span className="badge">{protocolLabel(l.protocol)}</span>
        <span className="badge">Governance lock</span>
        <span className={status.cls} title={status.tip}>
          {status.label}
        </span>
      </div>

      <div className="token-rows">
        <div className="token-row">
          <span className="sym">{l.token.symbol} locked</span>
          <span className="amt">
            {fmtAmount(l.token.amount)} <span className="usd">{fmtUsd(l.valueUsd)}</span>
          </span>
        </div>
        <div className="token-row" title="Current voting power. It decays toward zero as the unlock date approaches.">
          <span className="sym">Voting power</span>
          <span className="amt">
            {fmtAmount(l.votingPower)} <span className="usd">{veSymbol}</span>
          </span>
        </div>
      </div>

      {l.rewards.length > 0 && (
        <div>
          <div className="subhead">Claimable</div>
          <div className="token-rows">
            {l.rewards.map((r, i) => (
              <div
                className="token-row"
                key={`${r.address}-${r.kind}-${i}`}
                title={
                  r.kind === "rebase"
                    ? "Rebase: new tokens paid to lockers every week to offset emission dilution."
                    : "Voting rewards: swap fees and incentives from the pools this lock voted for."
                }
              >
                <span className="sym">
                  {r.symbol} <span className="usd">{r.kind === "rebase" ? "rebase" : "votes"}</span>
                </span>
                <span className="amt">
                  {fmtAmount(r.amount)} <span className="usd">{r.valueUsd !== null ? fmtUsd(r.valueUsd) : "—"}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="rewards-total">
            <span>Total claimable</span>
            <span>{fmtUsd(l.rewardsUsd)}</span>
          </div>
        </div>
      )}
    </article>
  );
}
