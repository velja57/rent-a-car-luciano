import { Link, useNavigate, useSearchParams } from 'react-router';
import PeriodPayments from '../components/PeriodPayments';
import { ErrorState, LoadingState } from '../components/States';
import { adminApi, useAdminData } from '../lib/adminApi';
import { addDays, formatDate, formatMoney, todayBelgrade } from '../lib/format';
import { FLEET_ORDER, vehicleById } from '../lib/labels';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Gotovi periodi (nedelja počinje ponedeljkom, isto kao u bazi).
function presets(today) {
  const weekStart = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
  const [y, m] = today.split('-').map(Number);
  const monthEnd = `${today.slice(0, 7)}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
  return [
    { key: 'today', label: 'Danas', stat: 'Prihod danas', from: today, to: today },
    { key: 'week', label: 'Ova nedelja', stat: 'Prihod ove nedelje', from: weekStart, to: addDays(weekStart, 6) },
    { key: 'month', label: 'Ovaj mesec', stat: 'Prihod ovog meseca', from: `${today.slice(0, 7)}-01`, to: monthEnd },
    { key: 'year', label: 'Ova godina', stat: 'Prihod ove godine', from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` },
  ];
}

// 1 najam, 2–4 najma, 5 najmova (21 najam, 22 najma...)
function rentalsLabel(n) {
  const lastTwo = n % 100;
  const last = n % 10;
  if (last === 1 && lastTwo !== 11) return `${n} najam`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} najma`;
  return `${n} najmova`;
}

function Stat({ label, value, sub, onClick, active }) {
  const body = (
    <>
      <span className="admin-stat__value">{value}</span>
      <span className="admin-stat__label">{label}</span>
      {sub && <span className="admin-stat__sub">{sub}</span>}
    </>
  );
  return onClick ? (
    <button
      type="button"
      className={`admin-stat admin-stat--link admin-stat--button${active ? ' admin-stat--active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {body}
    </button>
  ) : (
    <div className="admin-stat">{body}</div>
  );
}

// Preuzeti najmovi bez evidentirane naplate (npr. bez upisanog iznosa) — nisu u prihodu.
function UnpaidAlert({ rows }) {
  return (
    <div className="admin-alert admin-alert--warning admin-unpaid">
      <p>
        {rows.length === 1
          ? '1 preuzeti najam u ovom periodu nema evidentiranu naplatu i nije u prihodu:'
          : `Preuzeti najmovi u ovom periodu bez evidentirane naplate (nisu u prihodu): ${rows.length}`}
      </p>
      <ul>
        {rows.map((r) => (
          <li key={r.id}>
            <Link to={`/rezervacije/${r.id}`}>{r.customer_name}</Link>
            {' · '}
            {vehicleById(r.car_id)?.name ?? r.car_name} · {formatDate(r.pickup_date)} → {formatDate(r.return_date)}
            {r.total_price === null ? ' — iznos nije unet' : ` — iznos ${formatMoney(r.total_price)}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const today = todayBelgrade();
  const ranges = presets(today);
  const month = ranges.find((r) => r.key === 'month');
  const from = ISO_DATE.test(params.get('od') ?? '') ? params.get('od') : month.from;
  const rawTo = ISO_DATE.test(params.get('do') ?? '') ? params.get('do') : month.to;
  const to = rawTo < from ? from : rawTo;
  const active = ranges.find((r) => r.from === from && r.to === to)?.key ?? null;

  const setPeriod = (range) => {
    const next = new URLSearchParams(params);
    if (range.from === month.from && range.to === month.to) {
      next.delete('od');
      next.delete('do');
    } else {
      next.set('od', range.from);
      next.set('do', range.to);
    }
    setParams(next, { replace: true });
  };

  const { data, error, loading, reload } = useAdminData(() => adminApi.income({ from, to }), [from, to]);

  const period = data?.period;
  const summary = data?.summary;

  // Sva vozila iz ponude (i ona bez prihoda) + vozila koja više nisu u ponudi, a imaju prihod u periodu.
  const byCar = new Map((period?.by_car ?? []).map((c) => [c.car_id, c]));
  const carRows = [
    ...FLEET_ORDER.map((c) => byCar.get(c.id) ?? { car_id: c.id, amount: 0, rentals: 0 }),
    ...(period?.by_car ?? []).filter((c) => !FLEET_ORDER.some((f) => f.id === c.car_id)),
  ]
    .map((c) => ({ ...c, amount: Number(c.amount), car_name: vehicleById(c.car_id)?.name ?? c.car_name ?? c.car_id }))
    .sort((a, b) => b.amount - a.amount || a.car_name.localeCompare(b.car_name, 'sr'));
  const maxAmount = Math.max(...carRows.map((c) => c.amount), 0);

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1>Analitika prihoda</h1>
          <p className="admin-muted">
            Prihod je novac naplaćen pri preuzimanju vozila (datum = dan preuzimanja); povraćaji ga umanjuju. Otkazane
            rezervacije i one čije vozilo još nije preuzeto se ne računaju.
          </p>
        </div>
      </div>

      {!data && loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && (
        <div className={loading ? 'admin-table-wrap--loading admin-analytics' : 'admin-analytics'}>
          <div className="admin-stats admin-stats--5">
            <Stat label="Ukupan prihod" value={formatMoney(summary.all.amount)} sub={rentalsLabel(summary.all.rentals)} />
            {ranges.map((r) => (
              <Stat
                key={r.key}
                label={r.stat}
                value={formatMoney(summary[r.key].amount)}
                sub={rentalsLabel(summary[r.key].rentals)}
                active={active === r.key}
                onClick={() => setPeriod(r)}
              />
            ))}
          </div>

          <section className="admin-panel">
            <div className="admin-analytics-filters__row">
              <h2 className="admin-panel__title">Izabrani period</h2>
              <div className="admin-cal-toolbar__views" role="group" aria-label="Period">
                {ranges.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    className={`admin-chip${active === r.key ? ' admin-chip--on' : ''}`}
                    aria-pressed={active === r.key}
                    onClick={() => setPeriod(r)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="admin-analytics-filters__period">
                <input
                  type="date"
                  aria-label="Od"
                  value={from}
                  onChange={(e) => e.target.value && setPeriod({ from: e.target.value, to })}
                />
                <span className="admin-muted">do</span>
                <input
                  type="date"
                  aria-label="Do"
                  value={to}
                  min={from}
                  onChange={(e) => e.target.value && setPeriod({ from, to: e.target.value })}
                />
              </div>
            </div>
            <div className="admin-stats admin-stats--period">
              <Stat label={`Prihod · ${formatDate(from)} – ${formatDate(to)}`} value={formatMoney(period.amount)} />
              <Stat label="Realizovanih najmova (preuzeto vozilo)" value={period.rentals} />
            </div>
            {period.unpaid.length > 0 && <UnpaidAlert rows={period.unpaid} />}
          </section>

          <section className="admin-panel">
            <h2 className="admin-panel__title">Prihod po vozilu</h2>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--responsive">
                <thead>
                  <tr>
                    <th>Vozilo</th>
                    <th>Najmova</th>
                    <th>Prihod</th>
                  </tr>
                </thead>
                <tbody>
                  {carRows.map((c) => {
                    const known = Boolean(vehicleById(c.car_id));
                    return (
                      <tr
                        key={c.car_id}
                        className={known ? 'admin-row' : undefined}
                        onClick={known ? () => navigate(`/vozila/${c.car_id}`) : undefined}
                      >
                        <td data-label="Vozilo">
                          <div>
                            {known ? (
                              <Link to={`/vozila/${c.car_id}`} className="admin-link" onClick={(e) => e.stopPropagation()}>
                                {c.car_name}
                              </Link>
                            ) : (
                              <>
                                {c.car_name} <span className="admin-muted">(nije u ponudi)</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td data-label="Najmova">
                          <div>{c.rentals}</div>
                        </td>
                        <td data-label="Prihod">
                          <div className="admin-total-bar">
                            <strong className="admin-nowrap">{formatMoney(c.amount)}</strong>
                            <span className="admin-total-bar__track" aria-hidden="true">
                              <span style={{ width: maxAmount ? `${(Math.max(c.amount, 0) / maxAmount) * 100}%` : 0 }} />
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td data-label="Vozilo">
                      <div>
                        <strong>Ukupno</strong>
                      </div>
                    </td>
                    <td data-label="Najmova">
                      <div>{period.rentals}</div>
                    </td>
                    <td data-label="Prihod">
                      <div className="admin-nowrap">
                        <strong>{formatMoney(period.amount)}</strong>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="admin-muted admin-hint">Klik na vozilo otvara njegovu stranicu sa istorijom rezervacija.</p>
          </section>

          <section className="admin-panel admin-period-payments">
            <h2 className="admin-panel__title">Uplate u periodu</h2>
            <PeriodPayments key={`${from}|${to}`} from={from} to={to} />
          </section>
        </div>
      )}
    </div>
  );
}
