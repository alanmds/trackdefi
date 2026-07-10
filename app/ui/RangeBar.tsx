import type { RangeDTO } from "../../core/service";
import { fmtRangePrice } from "./format";

/**
 * Faixa de preço de uma posição concentrada: trilha = [min, max], marcador =
 * preço corrente (fixado na borda quando está fora). Status nunca é só cor:
 * o badge "In range ✓ / Out of range" fica no card, junto do nome.
 */
export default function RangeBar({ range }: { range: RangeDTO }) {
  const span = range.upper - range.lower;
  const rawPct = span > 0 ? ((range.current - range.lower) / span) * 100 : 50;
  const pct = Math.min(98.5, Math.max(1.5, rawPct));

  return (
    <div className={`rangebar${range.inRange ? "" : " out"}`}>
      <div className="track" role="img" aria-label={`Price range ${fmtRangePrice(range.lower)} to ${fmtRangePrice(range.upper)} ${range.quoteLabel}, current ${fmtRangePrice(range.current)}, ${range.inRange ? "in range" : "out of range"}`}>
        <div className="fill" />
        <div className="marker" style={{ left: `${pct}%` }} />
      </div>
      <div className="scale">
        <span>{fmtRangePrice(range.lower)}</span>
        <span>now {fmtRangePrice(range.current)}</span>
        <span>{fmtRangePrice(range.upper)}</span>
      </div>
      <div className="quote">{range.quoteLabel}</div>
    </div>
  );
}
