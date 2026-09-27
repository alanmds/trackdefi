import type { PositionDTO } from "../../core/service";
import { CHAINS } from "../../core/chains";
import { fmtAmount, fmtPct, fmtUsd, fmtUsdFine, fmtWindow, protocolLabel } from "./format";
import RangeBar from "./RangeBar";
import { noPriceTip } from "./notices";

function kindLabel(p: PositionDTO): string {
  if (p.kind === "concentrated") return "Concentrated";
  return p.kind === "v2-stable" ? "Classic · stable" : "Classic · volatile";
}

export default function PositionCard({ p, pricesFailed = false }: { p: PositionDTO; pricesFailed?: boolean }) {
  const chain = CHAINS[p.chainId];
  const explorerUrl = chain?.explorerUrl ?? "https://basescan.org";

  /* Todo "—" de preço ausente explica a si mesmo no tooltip: sem isso, quem o
     via ao lado do aviso de varredura achava que era falha e recarregava. */
  const semPreco = [p.token0, p.token1].filter((t) => t.valueUsd === null).map((t) => t.symbol);
  const recSemPreco = p.rewards.filter((r) => r.valueUsd === null).map((r) => r.symbol);
  const recComPrecoUsd = p.rewards.reduce((s, r) => s + (r.valueUsd ?? 0), 0);
  const tip = (symbols: string[]) => noPriceTip(symbols, pricesFailed);

  /* "Rendendo agora" (Receitas C2 + G v2). Desde 15/09/2026 são VÁRIAS linhas:
     uma por janela medida (24 h e 15 min), cada uma com o valor em dólar ao
     lado. O percentual sozinho engana quem opera no dia — anualizar 15 minutos
     multiplica por 35.040 —, então a escala em dinheiro anda junto sempre. */
  const e = p.earning;
  const poolRef = p.apr ? ` · pool ${fmtPct(p.apr.current)}` : "";
  const janelas = e?.windows ?? [];

  const tipJanelas =
    `Swap fees this position actually earned, measured in the pool contract. ` +
    `Each row shows one measurement window: the rate is annualised, the dollar figure is what was earned inside that window. ` +
    `A short window running far above the long one means the pool is busy right now.` +
    (p.apr ? ` Pool average of all in-range liquidity: ${fmtPct(p.apr.current)}/yr (${p.apr.source}).` : "");

  let earningSub = "";
  let earningTip = "";
  if (e && e.nowPct === 0 && janelas.length === 0) {
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
        {p.valueUsd !== null ? (
          <span className="pos-value">{fmtUsd(p.valueUsd)}</span>
        ) : (
          <span className="pos-value has-tip" title={tip(semPreco)}>
            —
          </span>
        )}
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

      {e && janelas.length > 0 ? (
        /* uma linha por janela medida — a curta em cima, que é a pergunta de
           quem opera no dia; emissões entram como linha própria porque não são
           medidas em janela, são a taxa corrente do gauge */
        <div className="earning" title={tipJanelas}>
          <div className="earning-head">
            Earning now
            {p.apr && <span className="earning-poolref">pool {fmtPct(p.apr.current)}</span>}
          </div>
          {janelas.map((w) => (
            <div className="earning-row" key={w.windowSec}>
              <span className="earning-when">Last {fmtWindow(w.windowSec)}</span>
              <b className="earning-pct">{fmtPct(w.feePct)}/yr</b>
              <span className="earning-usd">{fmtUsdFine(w.feeUsd)} in fees</span>
            </div>
          ))}
          {e.emissionPct !== null && (
            <div className="earning-row">
              <span className="earning-when">Emissions</span>
              <b className="earning-pct">{fmtPct(e.emissionPct)}/yr</b>
              <span className="earning-usd">current rate</span>
            </div>
          )}
        </div>
      ) : e && e.tooNew ? (
        /* A queixa que abriu esta frente foi um card MUDO. Posição nova demais
           tem de dizer o que está acontecendo, não sumir com a linha. */
        <div className="apr-line" title="This position was opened moments ago. Fees are measured over a window, and the shortest window the site uses is 15 minutes — so the first reading appears once the position is old enough to fill it.">
          <span className="apr-main">
            Earning now <b>—</b>
          </span>
          <span className="apr-sub">just opened · first reading in ~15 min{poolRef}</span>
        </div>
      ) : e ? (
        // fora do range, ou estimativa sem medição no contrato
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
              {fmtAmount(t.amount)}{" "}
              {t.valueUsd !== null ? (
                <span className="usd">{fmtUsd(t.valueUsd)}</span>
              ) : (
                <span className="usd has-tip" title={tip([t.symbol])}>
                  —
                </span>
              )}
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
                  {fmtAmount(r.amount)}{" "}
                  {r.valueUsd !== null ? (
                    <span className="usd">{fmtUsd(r.valueUsd)}</span>
                  ) : (
                    <span className="usd has-tip" title={tip([r.symbol])}>
                      —
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <div className="rewards-total">
            <span>Total claimable</span>
            {/* parte com preço soma; a sem preço aparece pelo nome, igual ao
                total do topo — antes um só token sem preço virava "—" no card todo */}
            {recSemPreco.length === 0 ? (
              <span>{fmtUsd(p.rewardsUsd)}</span>
            ) : recSemPreco.length === p.rewards.length ? (
              <span className="has-tip" title={tip(recSemPreco)}>
                —
              </span>
            ) : (
              <span className="has-tip" title={tip(recSemPreco)}>
                {fmtUsd(recComPrecoUsd)} <span className="usd">+ {[...new Set(recSemPreco)].join(", ")}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
