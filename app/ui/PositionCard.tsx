import type { PositionDTO } from "../../core/service";
import { fmtAmount, fmtUsd, protocolLabel } from "./format";
import RangeBar from "./RangeBar";

function kindLabel(p: PositionDTO): string {
  if (p.kind === "concentrated") return "Concentrated";
  return p.kind === "v2-stable" ? "Classic · stable" : "Classic · volatile";
}

export default function PositionCard({ p }: { p: PositionDTO }) {
  return (
    <article className="pos-card">
      <div className="pos-head">
        <h3 className="pos-title">
          <a
            href={`https://basescan.org/address/${p.poolAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            title="View pool on BaseScan"
          >
            {p.poolSymbol}
          </a>
        </h3>
        <span className="pos-value">{fmtUsd(p.valueUsd)}</span>
      </div>

      <div className="badges">
        <span className="badge">{protocolLabel(p.protocol)}</span>
        <span className="badge">{kindLabel(p)}</span>
        {p.range &&
          (p.range.inRange ? (
            <span className="badge badge-good">✓ In range</span>
          ) : (
            <span className="badge badge-warn">⚠ Out of range</span>
          ))}
        {p.staked && <span className="badge">Staked in gauge</span>}
        {p.managedByAlm && <span className="badge">ALM-managed</span>}
        {p.positionId && <span className="badge">NFT #{p.positionId}</span>}
      </div>

      <div className="token-rows">
        {[p.token0, p.token1].map((t) => (
          <div className="token-row" key={t.address}>
            <span className="sym">{t.symbol}</span>
            <span className="amt">
              {fmtAmount(t.amount)} <span className="usd">{t.valueUsd !== null ? fmtUsd(t.valueUsd) : "—"}</span>
            </span>
          </div>
        ))}
      </div>

      {p.range && <RangeBar range={p.range} />}

      {p.rewards.length > 0 && (
        <div>
          <div className="subhead">Claimable</div>
          <div className="token-rows">
            {p.rewards.map((r, i) => (
              <div className="token-row" key={`${r.address}-${r.kind}-${i}`}>
                <span className="sym">
                  {r.symbol} <span className="usd">{r.kind === "emission" ? "emissions" : "fees"}</span>
                </span>
                <span className="amt">
                  {fmtAmount(r.amount)} <span className="usd">{r.valueUsd !== null ? fmtUsd(r.valueUsd) : "—"}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="rewards-total">
            <span>Total claimable</span>
            <span>{fmtUsd(p.rewardsUsd)}</span>
          </div>
        </div>
      )}
    </article>
  );
}
