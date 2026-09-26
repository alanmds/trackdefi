"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PositionsResponseDTO } from "../../core/service";
import { networksDotted, networksSentence } from "../site";
import { fmtUsd, shortAddress } from "./format";
import LockCard from "./LockCard";
import PositionCard from "./PositionCard";

type ViewState =
  | { phase: "loading" }
  | { phase: "error"; code: string; message: string }
  | { phase: "done"; data: PositionsResponseDTO };

const ERROR_COPY: Record<string, { title: string; body: string }> = {
  invalid_address: { title: "Invalid address", body: "That doesn't look like a valid wallet address." },
  rate_limited: { title: "Too many requests", body: "Please wait a few seconds and try again." },
  timeout: { title: "The blockchain took too long", body: "The network is slow right now. Try again in a moment." },
  upstream: { title: "Couldn't reach the blockchain", body: "A network hiccup on our side. Try again in a moment." },
  busy: { title: "Server is busy", body: "We're scanning other wallets right now. Try again in a few seconds." },
  network: { title: "Connection problem", body: "Check your internet connection and try again." },
};

function Elapsed() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="scan-elapsed">{secs}s — a full scan takes ~15 s on the first visit</span>;
}

export default function PositionsView({ address }: { address: string }) {
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
            {copied ? "Copied ✓" : "Copy address"}
          </button>
          <button type="button" className="btn btn-sm" onClick={load} disabled={state.phase === "loading"}>
            Refresh
          </button>
        </div>
      </div>

      {state.phase === "loading" && (
        <>
          <div className="state-box" aria-live="polite">
            <div className="spinner" aria-hidden />
            <h2>Scanning the blockchains…</h2>
            <p>
              Reading Aerodrome, Velodrome and Uniswap v3 across {networksSentence()} — classic, concentrated and
              gauge-staked positions.
            </p>
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
          <h2>{(ERROR_COPY[state.code] ?? ERROR_COPY.upstream).title}</h2>
          <p>{state.message || (ERROR_COPY[state.code] ?? ERROR_COPY.upstream).body}</p>
          <button type="button" className="btn" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {state.phase === "done" && state.data.positions.length === 0 && (state.data.locks ?? []).length === 0 && (
        <div className="state-box">
          <h2>No liquidity positions found</h2>
          <p>
            This wallet has no active positions on Aerodrome, Velodrome or Uniswap v3 across {networksSentence()}{" "}
            right now.
          </p>
          <Link href="/" className="btn">
            Track another wallet
          </Link>
        </div>
      )}

      {state.phase === "done" && (state.data.positions.length > 0 || (state.data.locks ?? []).length > 0) && (
        <>
          <div className="kpis">
            <div className="kpi">
              <div className="label">Total in pools</div>
              <div className="value">{fmtUsd(state.data.totals.valueUsd)}</div>
              {state.data.totals.positionsWithoutPrice > 0 && (
                <div className="hint">
                  + {state.data.totals.positionsWithoutPrice} position
                  {state.data.totals.positionsWithoutPrice > 1 ? "s" : ""} without a reliable price
                </div>
              )}
            </div>
            {(state.data.locks ?? []).length > 0 && (
              <div className="kpi">
                <div className="label">Locked</div>
                <div className="value">{fmtUsd(state.data.totals.lockedUsd ?? 0)}</div>
                <div className="hint">
                  {[...new Set((state.data.locks ?? []).map((l) => `ve${l.token.symbol}`))].join(" + ")} governance locks
                </div>
              </div>
            )}
            <div className="kpi">
              <div className="label">Claimable rewards</div>
              <div className="value">{fmtUsd(state.data.totals.rewardsUsd)}</div>
              <div className="hint">
                {(state.data.locks ?? []).some((l) => l.rewards.length > 0)
                  ? "fees, emissions & lock rewards"
                  : "fees + emissions"}
              </div>
            </div>
            <div className="kpi">
              <div className="label">Positions</div>
              <div className="value">{state.data.totalPositions}</div>
              <div className="hint">scanned in {(state.data.scanMs / 1000).toFixed(1)} s</div>
            </div>
          </div>

          {state.data.totalPositions > state.data.positions.length && (
            <p className="scan-warnings">
              Showing the top {state.data.positions.length} positions by value (of {state.data.totalPositions}).
              Totals include all of them.
            </p>
          )}

          {state.data.warnings.length > 0 && (
            <p className="scan-warnings" title={state.data.warnings.join("\n")}>
              ⚠ {state.data.warnings.length} warning{state.data.warnings.length > 1 ? "s" : ""} during the scan — some
              data may be incomplete. Refresh to retry.
            </p>
          )}

          {/* Locks vêm ANTES das posições: são poucos (1 a 3, em geral) e
              costumam ser o maior valor da carteira — na demo, 83% dela. No fim
              de uma lista de 44 posições ninguém os veria. Sem lock, a tela
              fica exatamente como antes, sem títulos de seção. */}
          {(state.data.locks ?? []).length > 0 && (
            <>
              <h2 className="section-title">Governance locks</h2>
              <div className="positions-grid">
                {(state.data.locks ?? []).map((l) => (
                  <LockCard key={`${l.chainId}-${l.lockId}`} l={l} />
                ))}
              </div>
              {state.data.positions.length > 0 && <h2 className="section-title">Liquidity positions</h2>}
            </>
          )}

          <div className="positions-grid">
            {/* a rede entra na chave: nas redes-folha da Superchain o MESMO
                endereço de pool existe em várias redes (deploy determinístico)
                e o id do NFT recomeça em cada uma — o pool 0xc2026f… com o NFT
                #2 aparecia em Ink, Unichain e Soneium com a mesma chave */}
            {state.data.positions.map((p) => (
              <PositionCard key={`${p.chainId}-${p.poolAddress}-${p.positionId ?? "v2"}`} p={p} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
