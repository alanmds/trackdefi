"use client";

import type { RangeDTO } from "../../core/service";
import { fill } from "../i18n/rich";
import { useI18n } from "../i18n/provider";
import { fmtRangeDelta, fmtRangePrice } from "./format";

/**
 * Faixa de preço de uma posição concentrada: trilha = [min, max], marcador =
 * preço corrente (fixado na borda quando está fora). Embaixo de cada borda,
 * a distância do preço atual até ela, em %. Status nunca é só cor:
 * o badge "In range ✓ / Out of range" fica no card, junto do nome.
 */
export default function RangeBar({ range }: { range: RangeDTO }) {
  const { locale, ui } = useI18n();
  const span = range.upper - range.lower;
  const rawPct = span > 0 ? ((range.current - range.lower) / span) * 100 : 50;
  const pct = Math.min(98.5, Math.max(1.5, rawPct));
  // quanto o preço precisa andar até cada borda (embaixo de cada preço)
  const lowerDelta = fmtRangeDelta(range.lower, range.current, locale);
  const upperDelta = fmtRangeDelta(range.upper, range.current, locale);
  const price = (n: number) => fmtRangePrice(n, locale);

  return (
    <div className={`rangebar${range.inRange ? "" : " out"}`}>
      <div
        className="track"
        role="img"
        aria-label={fill(range.inRange ? ui.range.ariaIn : ui.range.ariaOut, {
          lower: price(range.lower),
          upper: price(range.upper),
          quote: range.quoteLabel,
          current: price(range.current),
        })}
      >
        <div className="fill" />
        <div className="marker" style={{ left: `${pct}%` }} />
      </div>
      <div className="scale">
        <span>{price(range.lower)}</span>
        <span>{fill(ui.range.now, { price: price(range.current) })}</span>
        <span>{price(range.upper)}</span>
      </div>
      {lowerDelta && upperDelta && (
        <div className="deltas" title={ui.range.deltasTip}>
          <span>{lowerDelta}</span>
          <span>{upperDelta}</span>
        </div>
      )}
      <div className="quote">{range.quoteLabel}</div>
    </div>
  );
}
