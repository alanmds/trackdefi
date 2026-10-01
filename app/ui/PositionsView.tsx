"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PositionsResponseDTO } from "../../core/service";
import { localePath } from "../i18n/config";
import { fill, pl } from "../i18n/rich";
import { useI18n } from "../i18n/provider";
import { networksDotted, networksSentence } from "../site";
import { fmtDecimal, fmtInt, fmtUsd, shortAddress } from "./format";
import LockCard from "./LockCard";
import PositionCard from "./PositionCard";
import { noPriceSummaryTip, noticeText } from "./notices";

type ViewState =
  | { phase: "loading" }
  | { phase: "error"; code: string; message: string }
  | { phase: "done"; data: PositionsResponseDTO };

/* Valor de 7 dígitos ("$1,234,987.65") não cabe na caixa com a fonte cheia
   quando há 4 caixas lado a lado — medido em 26/09/2026 no iPhone deitado e
   no computador. A partir de 12 caracteres a fonte encolhe; o resto não muda. */
function KpiValue({ text }: { text: string }) {
  return <div className={text.length > 11 ? "value value-long" : "value"}>{text}</div>;
}

function Elapsed() {
  const { ui } = useI18n();
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="scan-elapsed">{fill(ui.wallet.elapsed, { secs })}</span>;
}

export default function PositionsView({ address }: { address: string }) {
  const i18n = useI18n();
  const { locale, ui } = i18n;
  const w = ui.wallet;
  const [state, setState] = useState<ViewState>({ phase: "loading" });
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ phase: "loading" });
    try {
      const res = await fetch(`/api/positions?address=${address}`, { signal: ctrl.signal });
      const body = await res.json();
      if (!res.ok) {
        setState({ phase: "error", code: body.error ?? "upstream", message: body.message ?? "" });
        return;
      }
      setState({ phase: "done", data: body as PositionsResponseDTO });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setState({ phase: "error", code: "network", message: "" });
    }
  }, [address]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponível — sem drama */
    }
  }

  // `?? []`: fixture e respostas em cache anteriores a 26/09/2026 não têm o campo
  const notices = state.phase === "done" ? (state.data.notices ?? []) : [];
  // a fonte de preços falhou NESTA varredura → "—" pode sumir ao recarregar
  const pricesFailed = notices.some((n) => n.kind === "prices");
  const rewardsWithoutPrice = state.phase === "done" ? (state.data.totals.rewardsWithoutPrice ?? 0) : 0;
  const networks = networksSentence("and", locale);

  /* Os avisos de erro vêm do dicionário, por CÓDIGO. A `message` que a API
     devolve está em inglês e só serve de reserva para um código desconhecido —
     usá-la sempre faria o erro aparecer no idioma errado. */
  const errorCopy = state.phase === "error" ? (w.errors[state.code] ?? null) : null;

  return (
    <main className="container">
      <div className="wallet-head">
        <div className="wallet-id">
          <h1 title={address}>{shortAddress(address)}</h1>
          {/* sem link de explorer aqui: o cabeçalho vale para TODAS as redes e
              mandava todo mundo para o BaseScan, que só conhece a Base. Cada
              card já linka o seu pool no explorer da rede certa
              (PositionCard usa CHAINS[chainId].explorerUrl). */}
          <span className="wallet-sub">{networksDotted()}</span>
        </div>
        <div className="wallet-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
            {copied ? w.copied : w.copyAddress}
          </button>
          <button type="button" className="btn btn-sm" onClick={load} disabled={state.phase === "loading"}>
            {w.refresh}
          </button>
        </div>
      </div>

      {state.phase === "loading" && (
        <>
          <div className="state-box" aria-live="polite">
            <div className="spinner" aria-hidden />
            <h2>{w.scanning}</h2>
            <p>{fill(w.scanningBody, { networks })}</p>
            <Elapsed />
          </div>
          <div className="skeleton-grid" aria-hidden>
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        </>
      )}

      {state.phase === "error" && (
        <div className="state-box error" role="alert">
          <h2>{(errorCopy ?? w.errors.upstream).title}</h2>
          <p>{errorCopy ? errorCopy.body : state.message || w.errors.upstream.body}</p>
          <button type="button" className="btn" onClick={load}>
            {w.tryAgain}
          </button>
        </div>
      )}

      {state.phase === "done" && state.data.positions.length === 0 && (state.data.locks ?? []).length === 0 && (
        <div className="state-box">
          <h2>{w.empty.title}</h2>
          <p>{fill(w.empty.body, { networks })}</p>
          <Link href={localePath(locale, "/")} className="btn">
            {w.empty.another}
          </Link>
        </div>
      )}

      {state.phase === "done" && (state.data.positions.length > 0 || (state.data.locks ?? []).length > 0) && (
        <>
          <div className="kpis">
            <div className="kpi">
              <div className="label">{w.kpi.totalInPools}</div>
              <KpiValue text={fmtUsd(state.data.totals.valueUsd, locale)} />
              {state.data.totals.positionsWithoutPrice > 0 && (
                <div className="hint has-tip" title={noPriceSummaryTip("positions", pricesFailed, i18n)}>
                  {pl(locale, w.kpi.positionsWithoutPrice, state.data.totals.positionsWithoutPrice)}
                </div>
              )}
            </div>
            {(state.data.locks ?? []).length > 0 && (
              <div className="kpi">
                <div className="label">{w.kpi.locked}</div>
                <KpiValue text={fmtUsd(state.data.totals.lockedUsd ?? 0, locale)} />
                <div className="hint">
                  {fill(w.kpi.lockedHint, {
                    tokens: [...new Set((state.data.locks ?? []).map((l) => `ve${l.token.symbol}`))].join(" + "),
                  })}
                </div>
              </div>
            )}
            <div className="kpi">
              <div className="label">{w.kpi.claimable}</div>
              <KpiValue text={fmtUsd(state.data.totals.rewardsUsd, locale)} />
              <div className="hint">
                {(state.data.locks ?? []).some((l) => l.rewards.length > 0)
                  ? w.kpi.claimableHintLocks
                  : w.kpi.claimableHint}
              </div>
              {rewardsWithoutPrice > 0 && (
                <div className="hint has-tip" title={noPriceSummaryTip("rewards", pricesFailed, i18n)}>
                  {pl(locale, w.kpi.rewardsWithoutPrice, rewardsWithoutPrice)}
                </div>
              )}
            </div>
            <div className="kpi">
              <div className="label">{w.kpi.positions}</div>
              <div className="value">{state.data.totalPositions}</div>
              <div className="hint">
                {fill(w.kpi.scannedIn, {
                  s: fmtDecimal(state.data.scanMs / 1000, 1, locale),
                })}
              </div>
            </div>
          </div>

          {/* o glossário no lugar onde a dúvida nasce — no rodapé ele fica a
              44 posições de distância */}
          <p className="kpis-help">
            <Link href={localePath(locale, "/glossary")}>{w.glossaryLink}</Link>
          </p>

          {state.data.totalPositions > state.data.positions.length && (
            <p className="scan-warnings">
              {fill(w.showingTop, {
                shown: fmtInt(state.data.positions.length, locale),
                total: fmtInt(state.data.totalPositions, locale),
              })}
            </p>
          )}

          {/* Um aviso por linha, dizendo o que aconteceu. O log interno
              (`warnings`, em português) não aparece mais na tela — nem no
              tooltip, onde vazava texto de depuração para o visitante. */}
          {notices.length > 0 && (
            <ul className="scan-warnings scan-notices">
              {notices.map((n, i) => {
                const { text, retry } = noticeText(n, i18n);
                return (
                  <li key={i}>
                    ⚠ {text}
                    {retry && ` ${w.refreshToRetry}`}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Locks vêm ANTES das posições: são poucos (1 a 3, em geral) e
              costumam ser o maior valor da carteira — na demo, 83% dela. No fim
              de uma lista de 44 posições ninguém os veria. Sem lock, a tela
              fica exatamente como antes, sem títulos de seção. */}
          {(state.data.locks ?? []).length > 0 && (
            <>
              <h2 className="section-title">{w.sectionLocks}</h2>
              <div className="positions-grid">
                {(state.data.locks ?? []).map((l) => (
                  <LockCard key={`${l.chainId}-${l.lockId}`} l={l} />
                ))}
              </div>
              {state.data.positions.length > 0 && <h2 className="section-title">{w.sectionPositions}</h2>}
            </>
          )}

          <div className="positions-grid">
            {/* a rede entra na chave: nas redes-folha da Superchain o MESMO
                endereço de pool existe em várias redes (deploy determinístico)
                e o id do NFT recomeça em cada uma — o pool 0xc2026f… com o NFT
                #2 aparecia em Ink, Unichain e Soneium com a mesma chave */}
            {state.data.positions.map((p) => (
              <PositionCard
                key={`${p.chainId}-${p.poolAddress}-${p.positionId ?? "v2"}`}
                p={p}
                pricesFailed={pricesFailed}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
