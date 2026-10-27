"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CHAINS } from "../../core/chains";
import type { PairDTO, PairsDTO } from "../../core/discovery/pairs";
import { localePath } from "../i18n/config";
import { fill, pl, rich } from "../i18n/rich";
import { useI18n } from "../i18n/provider";
import { fmtInt, fmtPct, fmtUsdCompact, protocolLabel } from "./format";

/** quantas linhas a tela desenha — o resto fica no contador */
const MAX_ROWS = 100;
/** degraus dos filtros em dólar */
const STEPS = [0, 100_000, 1_000_000, 10_000_000, 100_000_000, 1_000_000_000];
type SortKey = "apr" | "volume1d" | "tvlUsd" | "mcapMin";
const SORTS: SortKey[] = ["apr", "volume1d", "tvlUsd", "mcapMin"];

/** Filtra e ordena — pura, exportada para os testes. Sem o número pedido, a linha não passa no filtro dele. */
export function filterPairs(
  pairs: PairDTO[],
  f: { q: string; chainId: number | null; protocol: string | null; minApr: number; minVolume: number; minMcap: number; minTvl: number; sort: SortKey },
): PairDTO[] {
  const termos = f.q
    .toUpperCase()
    .split(/[\s,/-]+/)
    .filter(Boolean);
  const passa = (v: number | null, min: number) => min <= 0 || (v !== null && v >= min);
  return pairs
    .filter((p) => {
      if (f.chainId !== null && p.chainId !== f.chainId) return false;
      if (f.protocol !== null && p.protocol !== f.protocol) return false;
      if (termos.length > 0) {
        const partes = p.symbol.toUpperCase().split("-");
        if (!termos.every((t) => partes.some((s) => s.includes(t)))) return false;
      }
      return passa(p.apr, f.minApr) && passa(p.volume1d, f.minVolume) && passa(p.mcapMin, f.minMcap) && passa(p.tvlUsd, f.minTvl);
    })
    .sort((a, b) => (b[f.sort] ?? -1) - (a[f.sort] ?? -1));
}

export default function PairFinder() {
  const { locale, ui } = useI18n();
  const t = ui.pairs;
  const [data, setData] = useState<PairsDTO | null>(null);
  const [failed, setFailed] = useState(false);

  const [q, setQ] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [minApr, setMinApr] = useState("");
  const [minVolume, setMinVolume] = useState(100_000);
  const [minMcap, setMinMcap] = useState(0);
  const [minTvl, setMinTvl] = useState(100_000);
  const [sort, setSort] = useState<SortKey>("apr");

  useEffect(() => {
    fetch("/api/pairs")
      .then((r) => (r.ok ? (r.json() as Promise<PairsDTO>) : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  // as opções saem dos dados: rede ou corretora sem pool não aparece
  const chains = useMemo(
    () =>
      [...new Set((data?.pairs ?? []).map((p) => p.chainId))].sort((a, b) =>
        (CHAINS[a]?.label ?? "").localeCompare(CHAINS[b]?.label ?? ""),
      ),
    [data],
  );
  const protocols = useMemo(() => [...new Set((data?.pairs ?? []).map((p) => p.protocol))].sort(), [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    const apr = Number(minApr.replace(",", "."));
    return filterPairs(data.pairs, {
      q,
      chainId,
      protocol,
      minApr: Number.isFinite(apr) ? apr : 0,
      minVolume,
      minMcap,
      minTvl,
      sort,
    });
  }, [data, q, chainId, protocol, minApr, minVolume, minMcap, minTvl, sort]);

  const usd = (n: number | null) => fmtUsdCompact(n, locale);
  const step = (v: number, set: (n: number) => void, label: string) => (
    <label className="sim-field">
      <span>{label}</span>
      <select value={v} onChange={(e) => set(Number(e.target.value))}>
        {STEPS.map((s) => (
          <option key={s} value={s}>
            {s === 0 ? t.any : `≥ ${usd(s)}`}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="pairs">
      <p className="sim-note sim-warn pairs-notice">
        {rich(t.aprNotice, {
          b: (c) => <strong>{c}</strong>,
          link: (c) => <Link href={localePath(locale, "/tools/apr-simulator")}>{c}</Link>,
        })}
      </p>

      <div className="pairs-filters">
        <label className="sim-field pairs-search">
          <span>{t.search}</span>
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="characters"
            placeholder={t.searchPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label className="sim-field">
          <span>{t.network}</span>
          <select value={chainId ?? ""} onChange={(e) => setChainId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t.all}</option>
            {chains.map((id) => (
              <option key={id} value={id}>
                {CHAINS[id]?.label ?? id}
              </option>
            ))}
          </select>
        </label>
        <label className="sim-field">
          <span>{t.protocol}</span>
          <select value={protocol ?? ""} onChange={(e) => setProtocol(e.target.value || null)}>
            <option value="">{t.all}</option>
            {protocols.map((p) => (
              <option key={p} value={p}>
                {protocolLabel(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="sim-field">
          <span>{t.minApr}</span>
          <input type="text" inputMode="decimal" placeholder="0" value={minApr} onChange={(e) => setMinApr(e.target.value)} />
        </label>
        {step(minVolume, setMinVolume, t.minVolume)}
        {step(minMcap, setMinMcap, t.minMcap)}
        {step(minTvl, setMinTvl, t.minTvl)}
        <label className="sim-field">
          <span>{t.sortBy}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t.sort[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {failed && <p className="form-error">{t.error}</p>}
      {!data && !failed && <p className="sim-muted">{t.loading}</p>}

      {data && (
        <>
          <p className="pairs-count">
            {pl(locale, t.count, rows.length, { n: fmtInt(rows.length, locale) })}
            {rows.length > MAX_ROWS && <> · {fill(t.showing, { n: MAX_ROWS })}</>}
          </p>
          {rows.length === 0 ? (
            <p className="sim-muted">{t.none}</p>
          ) : (
            <table className="pairs-table">
              <thead>
                <tr>
                  <th>{t.colPair}</th>
                  <th>{t.colWhere}</th>
                  <th className="num">{t.colApr}</th>
                  <th className="num">{t.colVolume}</th>
                  <th className="num">{t.colTvl}</th>
                  <th className="num">{t.colMcap}</th>
                  <th aria-hidden />
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, MAX_ROWS).map((p) => (
                  <tr key={p.id}>
                    <td data-label={t.colPair}>
                      <strong>{p.symbol.replace(/-/g, "/")}</strong>
                      {p.meta && <span className="sim-muted sim-block">{p.meta}</span>}
                    </td>
                    <td data-label={t.colWhere}>
                      {protocolLabel(p.protocol)} · {CHAINS[p.chainId]?.label ?? p.chainId}
                    </td>
                    <td data-label={t.colApr} className="num">
                      <strong>{fmtPct(p.apr, locale)}</strong>
                      {p.aprReward !== null && p.aprReward > 0 && (
                        <span className="sim-muted sim-block">
                          {fill(t.aprSplit, { base: fmtPct(p.aprBase, locale), reward: fmtPct(p.aprReward, locale) })}
                        </span>
                      )}
                    </td>
                    <td data-label={t.colVolume} className="num">
                      {usd(p.volume1d)}
                    </td>
                    <td data-label={t.colTvl} className="num">
                      {usd(p.tvlUsd)}
                    </td>
                    <td data-label={t.colMcap} className="num">
                      {usd(p.mcapMin)}
                    </td>
                    <td className="pairs-open">
                      {p.pool ? (
                        <Link
                          href={localePath(locale, `/tools/apr-simulator?pool=${p.pool}`)}
                          className="btn btn-ghost btn-sm"
                          title={t.simulateTitle}
                        >
                          {t.simulate}
                        </Link>
                      ) : (
                        <span className="pairs-soon" title={t.soonTitle}>
                          {t.soon}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="sim-muted pairs-source">{t.source}</p>
          <p className="sim-muted">{t.caveat}</p>
        </>
      )}
    </div>
  );
}
