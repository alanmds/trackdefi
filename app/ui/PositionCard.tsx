"use client";

import type { PositionDTO } from "../../core/service";
import { CHAINS } from "../../core/chains";
import { basicTags, fill, rich } from "../i18n/rich";
import { useI18n } from "../i18n/provider";
import { fmtAmount, fmtPct, fmtUsd, fmtUsdFine, fmtWindow, protocolLabel } from "./format";
import RangeBar from "./RangeBar";
import { noPriceTip, poolPriceTip } from "./notices";

export default function PositionCard({ p, pricesFailed = false }: { p: PositionDTO; pricesFailed?: boolean }) {
  const i18n = useI18n();
  const { locale, ui } = i18n;
  const t = ui.card;
  const chain = CHAINS[p.chainId];
  const explorerUrl = chain?.explorerUrl ?? "https://basescan.org";
  const usd = (n: number | null | undefined) => fmtUsd(n, locale);
  const pct = (n: number | null | undefined) => fmtPct(n, locale);

  const kindLabel =
    p.kind === "concentrated" ? t.kind.concentrated : p.kind === "v2-stable" ? t.kind.v2stable : t.kind.v2volatile;

  /* Todo "—" de preço ausente explica a si mesmo no tooltip: sem isso, quem o
     via ao lado do aviso de varredura achava que era falha e recarregava. */
  const semPreco = [p.token0, p.token1].filter((tk) => tk.valueUsd === null).map((tk) => tk.symbol);
  const recSemPreco = p.rewards.filter((r) => r.valueUsd === null).map((r) => r.symbol);
  const recComPrecoUsd = p.rewards.reduce((s, r) => s + (r.valueUsd ?? 0), 0);
  const tip = (symbols: string[]) => noPriceTip(symbols, pricesFailed, i18n);

  /* "Rendendo agora" (Receitas C2 + G v2). Desde 15/09/2026 são VÁRIAS linhas:
     uma por janela medida (24 h e 15 min), cada uma com o valor em dólar ao
     lado. O percentual sozinho engana quem opera no dia — anualizar 15 minutos
     multiplica por 35.040 —, então a escala em dinheiro anda junto sempre. */
  const e = p.earning;
  const poolRef = p.apr ? fill(t.poolRef, { pct: pct(p.apr.current) }) : "";
  const janelas = e?.windows ?? [];
  const poolAvg = p.apr ? fill(t.tipPoolAvg, { pct: pct(p.apr.current), source: p.apr.source }) : "";
  /** frases do tooltip, juntas por espaço — a média do pool só entra se houver */
  const sentences = (...parts: string[]) => parts.filter(Boolean).join(" ");

  const tipJanelas = sentences(t.tipWindows, poolAvg);

  let earningSub = "";
  let earningTip = "";
  if (e && e.nowPct === 0 && janelas.length === 0) {
    earningSub = `${t.outOfRangeSub}${poolRef}`;
    earningTip = sentences(
      p.staked ? t.tipOutOfRangeStaked : t.tipOutOfRange,
      p.apr ? fill(t.tipPoolInRange, { pct: pct(p.apr.current), source: p.apr.source }) : "",
    );
  } else if (e) {
    const parts: string[] = [];
    if (e.feePct !== null) parts.push(fill(t.partFees, { pct: pct(e.feePct) }));
    if (e.emissionPct !== null) parts.push(fill(t.partEmissions, { pct: pct(e.emissionPct) }));
    earningSub = `${parts.join(" + ")}${poolRef}`;
    earningTip = sentences(
      fill(t.tipEstimate, { parts: parts.join(" + ") || pct(e.nowPct) }),
      poolAvg,
      t.tipEstimateNote,
    );
  }

  /** valor em dólar de um token ou recompensa: com preço, com preço do pool ou sem preço */
  const money = (valueUsd: number | null, priceSource: string | undefined, symbol: string) =>
    valueUsd !== null ? (
      priceSource === "pool" ? (
        <span className="usd has-tip" title={poolPriceTip(symbol, i18n)}>
          {usd(valueUsd)}
        </span>
      ) : (
        <span className="usd">{usd(valueUsd)}</span>
      )
    ) : (
      <span className="usd has-tip" title={tip([symbol])}>
        —
      </span>
    );

  return (
    <article className="pos-card">
      <div className="pos-head">
        <h3 className="pos-title">
          <a
            href={`${explorerUrl}/address/${p.poolAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            title={fill(t.viewPool, { explorer: chain?.explorerLabel ?? t.theExplorer })}
          >
            {p.poolSymbol}
          </a>
        </h3>
        {p.valueUsd !== null ? (
          <span className="pos-value">{usd(p.valueUsd)}</span>
        ) : (
          <span className="pos-value has-tip" title={tip(semPreco)}>
            —
          </span>
        )}
      </div>

      <div className="badges">
        <span className="badge">{chain?.label ?? fill(ui.common.chainFallback, { id: p.chainId })}</span>
        <span className="badge">{protocolLabel(p.protocol)}</span>
        <span className="badge">{kindLabel}</span>
        {p.range &&
          (p.range.inRange ? (
            <span className="badge badge-good">{t.inRange}</span>
          ) : (
            <span className="badge badge-warn">{t.outOfRange}</span>
          ))}
        {p.staked && <span className="badge">{t.staked}</span>}
        {p.managedByAlm && <span className="badge">{t.alm}</span>}
        {p.positionId && <span className="badge">{fill(t.nft, { id: p.positionId })}</span>}
      </div>

      {e && janelas.length > 0 ? (
        /* uma linha por janela medida — a curta em cima, que é a pergunta de
           quem opera no dia; emissões entram como linha própria porque não são
           medidas em janela, são a taxa corrente do gauge */
        <div className="earning" title={tipJanelas}>
          <div className="earning-head">
            {t.earningNow}
            {p.apr && <span className="earning-poolref">{fill(t.poolShort, { pct: pct(p.apr.current) })}</span>}
          </div>
          {janelas.map((w) => (
            <div className="earning-row" key={w.windowSec}>
              <span className="earning-when">{fill(t.lastWindow, { window: fmtWindow(w.windowSec, ui.dates) })}</span>
              <b className="earning-pct">{fill(t.perYear, { pct: pct(w.feePct) })}</b>
              <span className="earning-usd">{fill(t.inFees, { usd: fmtUsdFine(w.feeUsd, locale) })}</span>
            </div>
          ))}
          {e.emissionPct !== null && (
            <div className="earning-row">
              <span className="earning-when">{t.emissions}</span>
              <b className="earning-pct">{fill(t.perYear, { pct: pct(e.emissionPct) })}</b>
              <span className="earning-usd">{t.currentRate}</span>
            </div>
          )}
        </div>
      ) : e && e.tooNew ? (
        /* A queixa que abriu esta frente foi um card MUDO. Posição nova demais
           tem de dizer o que está acontecendo, não sumir com a linha. */
        <div className="apr-line" title={t.tipJustOpened}>
          <span className="apr-main">{rich(t.earningLine, basicTags, { pct: "—" })}</span>
          <span className="apr-sub">
            {t.justOpenedSub}
            {poolRef}
          </span>
        </div>
      ) : e ? (
        // fora do range, ou estimativa sem medição no contrato
        <div className={`apr-line${e.nowPct === 0 ? " apr-zero" : ""}`} title={earningTip}>
          <span className="apr-main">{rich(t.earningLine, basicTags, { pct: pct(e.nowPct) })}</span>
          <span className="apr-sub">{earningSub}</span>
        </div>
      ) : (
        p.apr && (
          <div
            className="apr-line"
            title={fill(t.poolAprTip, {
              base: pct(p.apr.base),
              reward: pct(p.apr.reward),
              mean: pct(p.apr.mean30d),
              source: p.apr.source,
            })}
          >
            <span className="apr-main">{rich(t.poolAprLine, basicTags, { pct: pct(p.apr.current) })}</span>
            <span className="apr-sub">{fill(t.poolAprSub, { mean: pct(p.apr.mean30d), source: p.apr.source })}</span>
          </div>
        )
      )}

      <div className="token-rows">
        {[p.token0, p.token1].map((tk) => (
          <div className="token-row" key={tk.address}>
            <span className="sym">{tk.symbol}</span>
            <span className="amt">
              {fmtAmount(tk.amount, locale)} {money(tk.valueUsd, tk.priceSource, tk.symbol)}
            </span>
          </div>
        ))}
      </div>

      {p.range && <RangeBar range={p.range} />}

      {p.rewards.length > 0 && (
        <div>
          <div className="subhead">{t.claimable}</div>
          <div className="token-rows">
            {p.rewards.map((r, i) => (
              <div className="token-row" key={`${r.address}-${r.kind}-${i}`}>
                <span className="sym">
                  {r.symbol} <span className="usd">{r.kind === "emission" ? t.rewardEmission : t.rewardFee}</span>
                </span>
                <span className="amt">
                  {fmtAmount(r.amount, locale)} {money(r.valueUsd, r.priceSource, r.symbol)}
                </span>
              </div>
            ))}
          </div>
          <div className="rewards-total">
            <span>{t.totalClaimable}</span>
            {/* parte com preço soma; a sem preço aparece pelo nome, igual ao
                total do topo — antes um só token sem preço virava "—" no card todo */}
            {recSemPreco.length === 0 ? (
              <span>{usd(p.rewardsUsd)}</span>
            ) : recSemPreco.length === p.rewards.length ? (
              <span className="has-tip" title={tip(recSemPreco)}>
                —
              </span>
            ) : (
              <span className="has-tip" title={tip(recSemPreco)}>
                {usd(recComPrecoUsd)} <span className="usd">+ {[...new Set(recSemPreco)].join(", ")}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
