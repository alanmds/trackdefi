"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CHAINS } from "../../core/chains";
import { SIMULATOR_PROTOCOLS, simulate, usdPer, type SimPoolDTO } from "../../core/simulator/math";
import { tickToPrice0In1 } from "../../core/math/ticks";
import { basicTags, fill, rich } from "../i18n/rich";
import { useI18n } from "../i18n/provider";
import { humanList } from "../site";
import { fmtAmount, fmtPct, fmtRangePrice, fmtUnixDate, fmtUsd, fmtWindow, protocolLabel } from "./format";

/** faixas prontas, em ± % do preço atual */
const PRESETS = [1, 5, 10, 25];
const MIN_TVL_USD = 10_000; // mesmo piso do APR da carteira (positionApr.ts)

/** Número digitado → número. Aceita vírgula ou ponto como decimal, conforme o idioma. */
function parseNum(s: string, decimalComma: boolean): number {
  const t = s.trim().replace(/\s/g, "");
  if (!t) return NaN;
  const norm = decimalComma ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  return Number(norm);
}

/** Número → texto editável (sem separador de milhar, para não confundir na volta). */
function editable(n: number, decimalComma: boolean): string {
  if (!Number.isFinite(n)) return "";
  const s = Number(n.toPrecision(6)).toString();
  return decimalComma ? s.replace(".", ",") : s;
}

export default function AprSimulator() {
  const { locale, ui } = useI18n();
  const t = ui.simulator;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const decimalComma = (1.5).toLocaleString(locale).includes(",");

  const [input, setInput] = useState(params.get("pool") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pools, setPools] = useState<SimPoolDTO[]>([]);
  const [idx, setIdx] = useState(0);
  const pool = pools[idx] ?? null;

  const [amount, setAmount] = useState("1000");
  const [inverted, setInverted] = useState(false);
  const [minStr, setMinStr] = useState("");
  const [maxStr, setMaxStr] = useState("");
  const [full, setFull] = useState(false);
  const [staked, setStaked] = useState(true);

  // preço atual na direção da tela
  const cur0in1 = pool ? tickToPrice0In1(pool.tick, pool.token0.decimals, pool.token1.decimals) : NaN;
  const show = useCallback((p0in1: number) => (inverted ? 1 / p0in1 : p0in1), [inverted]);
  const base = pool ? (inverted ? pool.token1 : pool.token0) : null;
  const quote = pool ? (inverted ? pool.token0 : pool.token1) : null;

  const applyPreset = useCallback(
    (pct: number, curShown: number) => {
      setFull(false);
      setMinStr(editable(curShown * (1 - pct / 100), decimalComma));
      setMaxStr(editable(curShown * (1 + pct / 100), decimalComma));
    },
    [decimalComma],
  );

  const load = useCallback(
    async (text: string) => {
      setError("");
      setLoading(true);
      try {
        const res = await fetch(`/api/pool?address=${encodeURIComponent(text.trim())}`);
        const body = (await res.json()) as { pools?: SimPoolDTO[]; error?: string };
        if (!res.ok || !body.pools || body.pools.length === 0) {
          setPools([]);
          setError(t.errors[body.error ?? "generic"] ?? t.errors.generic);
          return;
        }
        setPools(body.pools);
        setIdx(0);
        const p = body.pools[0];
        // mesma regra do card da carteira: preço fracionário aparece invertido
        const c = tickToPrice0In1(p.tick, p.token0.decimals, p.token1.decimals);
        const inv = c > 0 && c < 1;
        setInverted(inv);
        applyPreset(5, inv ? 1 / c : c);
        const q = new URLSearchParams(params.toString());
        q.set("pool", p.poolAddress);
        router.replace(`${pathname}?${q.toString()}`, { scroll: false });
      } catch {
        setPools([]);
        setError(t.errors.generic);
      } finally {
        setLoading(false);
      }
    },
    [applyPreset, params, pathname, router, t.errors],
  );

  // link compartilhado (?pool=0x…) carrega sozinho
  useEffect(() => {
    const p = params.get("pool");
    if (p) void load(p);
    // só na chegada
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/0x[0-9a-fA-F]{40}/.test(input)) {
      setError(t.errors.invalid);
      return;
    }
    void load(input);
  }

  function flip() {
    if (!pool) return;
    const lo = parseNum(minStr, decimalComma);
    const hi = parseNum(maxStr, decimalComma);
    setInverted(!inverted);
    if (lo > 0 && hi > 0) {
      setMinStr(editable(1 / hi, decimalComma));
      setMaxStr(editable(1 / lo, decimalComma));
    }
  }

  const result = useMemo(() => {
    if (!pool) return null;
    const dep = parseNum(amount, decimalComma);
    let lo: number;
    let hi: number;
    if (full) {
      lo = 0;
      hi = Infinity;
    } else {
      const a = parseNum(minStr, decimalComma);
      const b = parseNum(maxStr, decimalComma);
      if (!(a > 0) || !(b > 0) || a === b) return null;
      // a tela fala na direção escolhida; a conta, sempre em token1 por token0
      [lo, hi] = inverted ? [1 / Math.max(a, b), 1 / Math.min(a, b)] : [Math.min(a, b), Math.max(a, b)];
    }
    return simulate(pool, { depositUsd: dep, priceLower: lo, priceUpper: hi, staked });
  }, [pool, amount, minStr, maxStr, full, inverted, staked, decimalComma]);

  const usd = (n: number | null | undefined) => fmtUsd(n, locale);
  const pct = (n: number | null | undefined) => fmtPct(n, locale);
  const price = (p0in1: number) => fmtRangePrice(show(p0in1), locale);
  const dep = parseNum(amount, decimalComma);

  const chain = pool ? CHAINS[pool.chainId] : null;
  const missingPrice = pool && (pool.price0Usd === null ? pool.token0.symbol : pool.price1Usd === null ? pool.token1.symbol : null);
  const e = pool?.emission ?? null;
  const emissionActive = e !== null && e.endedAt === undefined && e.ratePerSec !== "0";

  return (
    <div className="sim">
      <form className="search-form sim-form" onSubmit={submit}>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          enterKeyHint="go"
          placeholder={t.poolPlaceholder}
          aria-label={t.poolLabel}
          value={input}
          onChange={(ev) => {
            setInput(ev.target.value);
            if (error) setError("");
          }}
        />
        <button type="submit" className="btn" disabled={loading}>
          {loading ? t.loading : t.load}
        </button>
      </form>
      <p className="form-error" role="alert">
        {error}
      </p>
      <p className="sim-supported">
        {fill(t.supported, { protocols: humanList([...new Set(SIMULATOR_PROTOCOLS.map(protocolLabel))], "and", locale) })}
      </p>

      {pools.length > 1 && (
        <div className="sim-chains">
          <span>{t.alsoOn}</span>
          {pools.map((p, i) => (
            <button
              key={p.chainId}
              type="button"
              className={`chip${i === idx ? " chip-on" : ""}`}
              aria-pressed={i === idx}
              onClick={() => setIdx(i)}
            >
              {CHAINS[p.chainId]?.label ?? p.chainId}
            </button>
          ))}
        </div>
      )}

      {pool && base && quote && (
        <section className="pos-card sim-card" aria-live="polite">
          <div className="sim-pool">
            <div>
              <h2 className="pos-title">{pool.poolSymbol}</h2>
              <p className="sim-sub">
                {fill(t.poolOn, { protocol: protocolLabel(pool.protocol), network: chain?.label ?? String(pool.chainId) })}
                {pool.feePips !== null && <> · {fill(t.feeTier, { fee: fmtPct(pool.feePips / 10_000, locale) })}</>}
                {" · "}
                {fill(t.tvl, { usd: usd(pool.tvlUsd) })}
                {chain && (
                  <>
                    {" · "}
                    <a href={`${chain.explorerUrl}/address/${pool.poolAddress}`} target="_blank" rel="noopener noreferrer">
                      {fill(t.viewPool, { explorer: chain.explorerLabel })}
                    </a>
                  </>
                )}
              </p>
            </div>
            <div className="sim-price">
              <span className="sim-label">{t.currentPrice}</span>
              <strong>{price(cur0in1)}</strong>
              <span className="sim-unit">
                {fill(t.perUnit, { quote: quote.symbol, base: base.symbol })}{" "}
                <button type="button" className="sim-flip" onClick={flip} aria-label={t.flip} title={t.flip}>
                  ⇄
                </button>
              </span>
            </div>
          </div>

          <div className="sim-inputs">
            <label className="sim-field">
              <span>{t.amountLabel}</span>
              <input type="text" inputMode="decimal" value={amount} onChange={(ev) => setAmount(ev.target.value)} />
            </label>
            <fieldset className="sim-range">
              <legend>{t.rangeLabel}</legend>
              <label className="sim-field">
                <span>{t.minLabel}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={full ? "0" : minStr}
                  // sair da faixa inteira volta para a faixa que estava antes
                  onFocus={() => setFull(false)}
                  onChange={(ev) => {
                    setFull(false);
                    setMinStr(ev.target.value);
                  }}
                />
              </label>
              <label className="sim-field">
                <span>{t.maxLabel}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={full ? "∞" : maxStr}
                  onFocus={() => setFull(false)}
                  onChange={(ev) => {
                    setFull(false);
                    setMaxStr(ev.target.value);
                  }}
                />
              </label>
              <div className="sim-presets" role="group" aria-label={t.presetsAria}>
                {PRESETS.map((p) => (
                  <button key={p} type="button" className="chip" onClick={() => applyPreset(p, show(cur0in1))}>
                    ±{p}%
                  </button>
                ))}
                <button type="button" className={`chip${full ? " chip-on" : ""}`} aria-pressed={full} onClick={() => setFull(true)}>
                  {t.fullRange}
                </button>
              </div>
            </fieldset>
            {e?.requiresStake && emissionActive && (
              <label className="sim-check">
                <input type="checkbox" checked={staked} onChange={(ev) => setStaked(ev.target.checked)} />
                <span>{fill(t.stakedLabel, { token: e.token.symbol })}</span>
              </label>
            )}
          </div>

          {missingPrice && <p className="sim-note sim-warn">{fill(t.noPrice, { token: missingPrice })}</p>}
          {pool.tvlUsd !== null && pool.tvlUsd < MIN_TVL_USD && (
            <p className="sim-note sim-warn">{fill(t.smallPool, { usd: usd(pool.tvlUsd) })}</p>
          )}

          {result && (
            <>
              {!full && (
                <p className="sim-note">
                  {fill(t.adjusted, {
                    min: price(inverted ? result.priceUpper : result.priceLower),
                    max: price(inverted ? result.priceLower : result.priceUpper),
                  })}
                </p>
              )}
              {!result.inRangeNow && <p className="sim-note sim-warn">{t.outOfRange}</p>}

              {result.inRangeNow && (
                <div className="sim-headline">
                  <span className="sim-label">{t.headline}</span>
                  <strong>{fill(t.perYear, { pct: pct(result.inRangePct) })}</strong>
                  {result.inRangePct !== null && dep > 0 && (
                    <span className="sim-unit">
                      {fill(t.perDayMonth, {
                        day: usd(usdPer(result.inRangePct, dep, 1)),
                        month: usd(usdPer(result.inRangePct, dep, 30)),
                      })}
                    </span>
                  )}
                </div>
              )}

              <dl className="sim-rows">
                {result.fees.length === 0 ? (
                  <div className="sim-row">
                    <dt>{t.feesLabel}</dt>
                    <dd className="sim-muted">{t.feesNone}</dd>
                  </div>
                ) : (
                  result.fees.map((f) => (
                    <div className="sim-row" key={f.windowSec}>
                      <dt>{fill(t.feesRow, { window: fmtWindow(f.windowSec, ui.dates) })}</dt>
                      <dd>{fill(t.perYear, { pct: pct(f.pct) })}</dd>
                    </div>
                  ))
                )}
                <div className="sim-row">
                  <dt>{e ? fill(t.emissionsRow, { token: e.token.symbol }) : t.emissionsLabel}</dt>
                  <dd>
                    {!e ? (
                      <span className="sim-muted">{t.noIncentive}</span>
                    ) : e.endedAt !== undefined ? (
                      <>0% · {fill(t.emissionsEnded, { date: fmtUnixDate(e.endedAt, ui.dates) })}</>
                    ) : e.requiresStake && !staked ? (
                      <>0% · {t.emissionsNeedStake}</>
                    ) : (
                      fill(t.perYear, { pct: pct(result.emissionPct) })
                    )}
                  </dd>
                </div>
                <div className="sim-row">
                  <dt>{t.timeRow}</dt>
                  <dd>
                    {result.timeInRange === null ? (
                      <span className="sim-muted">{t.timeNone}</span>
                    ) : (
                      <>
                        {fill(t.timeValue, { pct: pct(result.timeInRange * 100) })}
                        {result.historyLow !== null && result.historyHigh !== null && (
                          <span className="sim-muted sim-block">
                            {fill(t.historyRange, {
                              low: price(inverted ? result.historyHigh : result.historyLow),
                              high: price(inverted ? result.historyLow : result.historyHigh),
                            })}
                          </span>
                        )}
                      </>
                    )}
                  </dd>
                </div>
                {result.repeatPct !== null && (
                  <div className="sim-row">
                    <dt>{t.repeatRow}</dt>
                    <dd>
                      {fill(t.perYear, { pct: pct(result.repeatPct) })}
                      {dep > 0 && (
                        <span className="sim-muted sim-block">
                          {fill(t.perDayMonth, {
                            day: usd(usdPer(result.repeatPct, dep, 1)),
                            month: usd(usdPer(result.repeatPct, dep, 30)),
                          })}
                        </span>
                      )}
                    </dd>
                  </div>
                )}
                <div className="sim-row">
                  <dt>{t.depositRow}</dt>
                  <dd>
                    {fmtAmount(result.amount0, locale)} {pool.token0.symbol} + {fmtAmount(result.amount1, locale)}{" "}
                    {pool.token1.symbol}
                  </dd>
                </div>
              </dl>

              {!result.fullRange && (
                <ul className="sim-edges">
                  {/* bordas na direção da tela: a de baixo primeiro */}
                  {(inverted
                    ? [
                        { p: result.priceUpper, sym: pool.token1.symbol, amt: result.atUpper.amount1, tpl: t.atMin },
                        { p: result.priceLower, sym: pool.token0.symbol, amt: result.atLower.amount0, tpl: t.atMax },
                      ]
                    : [
                        { p: result.priceLower, sym: pool.token0.symbol, amt: result.atLower.amount0, tpl: t.atMin },
                        { p: result.priceUpper, sym: pool.token1.symbol, amt: result.atUpper.amount1, tpl: t.atMax },
                      ]
                  ).map((b) => (
                    <li key={b.tpl}>
                      {fill(b.tpl, { price: price(b.p), token: b.sym, amount: fmtAmount(b.amt, locale) })}
                    </li>
                  ))}
                  {result.inRangeNow && result.concentration !== null && result.concentration > 1.05 && (
                    <li>{fill(t.concentration, { x: fmtAmount(Math.round(result.concentration * 10) / 10, locale) })}</li>
                  )}
                  {result.inRangeNow && (
                    <li>{fill(t.share, { pct: pct(result.shareOfActive * 100) })}</li>
                  )}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      {pool && (
        <aside className="sim-how">
          <h2>{t.howTitle}</h2>
          <ul>
            {t.how.map((s) => (
              <li key={s}>{rich(s, basicTags)}</li>
            ))}
          </ul>
          <p className="sim-muted">{t.caveat}</p>
        </aside>
      )}
    </div>
  );
}
