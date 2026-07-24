import type { PositionDTO } from "../../core/service";
import { CHAINS } from "../../core/chains";
import { fmtAmount, fmtPct, fmtUsd, protocolLabel } from "./format";
import RangeBar from "./RangeBar";

function kindLabel(p: PositionDTO): string {
  if (p.kind === "concentrated") return "Concentrated";
  return p.kind === "v2-stable" ? "Classic · stable" : "Classic · volatile";
}

export default function PositionCard({ p }: { p: PositionDTO }) {
  const chain = CHAINS[p.chainId];
  const explorerUrl = chain?.explorerUrl ?? "https://basescan.org";

  // "rendendo agora" (Receita C2): número da POSIÇÃO; APR do pool vira referência
  const e = p.earning;
  const poolRef = p.apr ? ` · pool ${fmtPct(p.apr.current)}` : "";
  let earningSub = "";
  let earningTip = "";
  if (e && e.nowPct === 0) {
    earningSub = `out of range${poolRef}`;
    earningTip =
      `Out of range: this position is earning no swap fees right now` +
      `${p.staked ? " and gauge emissions are paused" : ""}. Fees already accrued stay claimable.` +
      (p.apr ? ` In-range liquidity in this pool averages ${fmtPct(p.apr.current)}/yr (${p.apr.source}).` : "");
  } else if (e) {
    const parts: string[] = [];
    if (e.feePct !== null) parts.push(`fees ${fmtPct(e.feePct)}`);
    if (e.emissionPct !== null) parts.push(`emissions ${fmtPct(e.emissionPct)}`);
    earningSub = `${parts.join(" + ")}${poolRef}`;
    earningTip =
      `Estimated yield THIS position is earning right now (${parts.join(" + ") || fmtPct(e.nowPct)}).` +
      (p.apr ? ` Pool average of all in-range liquidity: ${fmtPct(p.apr.current)}/yr (${p.apr.source}).` : "") +
      ` Estimate from live pool data — not a realized return.`;
  }

  return (
    <article className="pos-card">
      <div className="pos-head">
        <h3 className="pos-title">
          <a
            href={`${explorerUrl}/address/${p.poolAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`View pool on ${chain?.explorerLabel ?? "the explorer"}`}
          >
            {p.poolSymbol}
          </a>
        </h3>
        <span className="pos-value">{fmtUsd(p.valueUsd)}</span>
      </div>

      <div className="badges">
        <span className="badge">{chain?.label ?? `chain ${p.chainId}`}</span>
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

      {e ? (
        // "rendendo agora" da POSIÇÃO (taxas + emissões); 0 fora do range
        <div className={`apr-line${e.nowPct === 0 ? " apr-zero" : ""}`} title={earningTip}>
          <span className="apr-main">
            Earning now <b>{fmtPct(e.nowPct)}</b>
          </span>
          <span className="apr-sub">{earningSub}</span>
        </div>
      ) : (
        p.apr && (
          <div
            className="apr-line"
            title={`Pool APR — fees: ${fmtPct(p.apr.base)} · rewards: ${fmtPct(p.apr.reward)} · 30d average: ${fmtPct(p.apr.mean30d)}. Property of the pool, not your personal return. Source: ${p.apr.source}.`}
          >
            <span className="apr-main">
              Pool APR <b>{fmtPct(p.apr.current)}</b>
            </span>
            <span className="apr-sub">
              30d avg {fmtPct(p.apr.mean30d)} · {p.apr.source}
            </span>
          </div>
        )
      )}

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
