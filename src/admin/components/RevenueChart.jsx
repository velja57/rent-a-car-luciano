import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../lib/format';

const HEIGHT = 240;
const PAD = { top: 12, right: 8, bottom: 28, left: 56 };
const GAP = 2; // razmak između najma i dodataka u istom stubiću

// Okrugla gornja ivica (kraj stubića), ravna donja (na osnovi).
function topRoundedRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + radius}Q${x},${y} ${x + radius},${y}H${x + w - radius}Q${x + w},${y} ${x + w},${y + radius}V${y + h}Z`;
}

// "Lepa" gornja granica ose (1, 2, 5 × 10^n).
function niceMax(value) {
  if (value <= 0) return 100;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= value);
  return step * power;
}

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

// Stubići prihoda po periodu: najam (dole) + dodaci (gore). buckets: [{ key, label, rental, extras }].
export default function RevenueChart({ buckets, title }) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState(null);

  const max = niceMax(Math.max(...buckets.map((b) => b.rental + b.extras), 0));
  const plotW = Math.max(width - PAD.left - PAD.right, 0);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = buckets.length ? plotW / buckets.length : 0;
  const barW = Math.max(Math.min(band * 0.68, 44), 2);
  const y = (value) => PAD.top + plotH - (value / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  // Natpis ispod svakog n-tog stubića, da se ne preklapaju.
  const labelEvery = Math.max(1, Math.ceil(buckets.length / Math.max(1, Math.floor(plotW / 44))));
  const hovered = active === null ? null : buckets[active];

  return (
    <figure className="admin-chart" aria-label={title}>
      <div className="admin-chart__legend">
        <span>
          <i className="admin-chart__swatch admin-chart__swatch--rental" /> Najam
        </span>
        <span>
          <i className="admin-chart__swatch admin-chart__swatch--extras" /> Dodaci
        </span>
      </div>
      <div className="admin-chart__plot" ref={ref} onMouseLeave={() => setActive(null)}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label={title}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line className="admin-chart__grid" x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} />
                <text className="admin-chart__axis" x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
                  {formatMoney(Math.round(tick))}
                </text>
              </g>
            ))}
            {buckets.map((b, i) => {
              const x = PAD.left + i * band + (band - barW) / 2;
              const rentalH = (b.rental / max) * plotH;
              const extrasH = (b.extras / max) * plotH;
              const base = PAD.top + plotH;
              return (
                <g key={b.key} className={active === i ? 'admin-chart__bar admin-chart__bar--active' : 'admin-chart__bar'}>
                  {rentalH > 0 && (
                    <path
                      className="admin-chart__rental"
                      d={
                        extrasH > 0
                          ? `M${x},${base}V${base - rentalH}H${x + barW}V${base}Z`
                          : topRoundedRect(x, base - rentalH, barW, rentalH, 4)
                      }
                    />
                  )}
                  {extrasH > 0 && (
                    <path
                      className="admin-chart__extras"
                      d={topRoundedRect(x, base - rentalH - extrasH - (rentalH > 0 ? GAP : 0), barW, extrasH, 4)}
                    />
                  )}
                  {i % labelEvery === 0 && (
                    <text className="admin-chart__axis" x={x + barW / 2} y={HEIGHT - 8} textAnchor="middle">
                      {b.label}
                    </text>
                  )}
                  {/* Šira nevidljiva zona za miš i tastaturu */}
                  <rect
                    className="admin-chart__hit"
                    x={PAD.left + i * band}
                    y={PAD.top}
                    width={band}
                    height={plotH}
                    tabIndex={0}
                    aria-label={`${b.fullLabel}: ukupno ${formatMoney(b.rental + b.extras)}`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                  />
                </g>
              );
            })}
            <line className="admin-chart__baseline" x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} />
          </svg>
        )}
        {hovered && (
          <div
            className="admin-chart__tooltip"
            style={{
              left: Math.min(Math.max(PAD.left + active * band + band / 2, 90), width - 90),
              top: Math.max(y(hovered.rental + hovered.extras) - 12, 0),
            }}
            role="status"
          >
            <strong>{hovered.fullLabel}</strong>
            <span>
              <i className="admin-chart__swatch admin-chart__swatch--rental" /> Najam {formatMoney(hovered.rental)}
            </span>
            <span>
              <i className="admin-chart__swatch admin-chart__swatch--extras" /> Dodaci {formatMoney(hovered.extras)}
            </span>
            <span>Ukupno {formatMoney(hovered.rental + hovered.extras)}</span>
          </div>
        )}
      </div>
    </figure>
  );
}
