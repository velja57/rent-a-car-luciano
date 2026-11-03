import { Link, useNavigate, useSearchParams } from 'react-router';
import RevenueChart from '../components/RevenueChart';
import StatusBadge from '../components/StatusBadge';
import { ErrorState, LoadingState } from '../components/States';
import { adminApi, useAdminData } from '../lib/adminApi';
import { addDays, daysBetween, formatDate, formatMoney, todayBelgrade } from '../lib/format';
import { FLEET_ORDER, MONTHS, vehicleById } from '../lib/labels';

const PERIODS = { dan: 'Dan', mesec: 'Mesec', godina: 'Godina', raspon: 'Raspon' };
const MODES = {
  rental: {
    label: 'Po danima najma',
    hint: 'Prihod rezervacije je raspoređen na dane kada je vozilo kod kupca (od dana preuzimanja do dana pre vraćanja).',
  },
  booking: {
    label: 'Po datumu rezervacije',
    hint: 'Ceo iznos rezervacije pripada danu kada je rezervacija napravljena.',
  },
};
const SCOPES = {
  booked: { label: 'Ugovoreno', hint: 'potvrđene, preuzete i završene rezervacije' },
  realized: { label: 'Realizovano', hint: 'samo završene rezervacije' },
};
const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));

function lastDayOfMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
}

function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

// Period iz adrese stranice -> { from, to, label }.
function periodRange(type, params, today) {
  if (type === 'dan') {
    const day = params.get('datum') || today;
    return { from: day, to: day, label: formatDate(day), anchor: day };
  }
  if (type === 'godina') {
    const year = params.get('godina') || today.slice(0, 4);
    return { from: `${year}-01-01`, to: `${year}-12-31`, label: `${year}. godina`, anchor: year };
  }
  if (type === 'raspon') {
    const from = params.get('od') || `${today.slice(0, 7)}-01`;
    const to = params.get('do') || today;
    return { from, to: to < from ? from : to, label: `${formatDate(from)} – ${formatDate(to < from ? from : to)}` };
  }
  const month = params.get('mesec') || today.slice(0, 7);
  return {
    from: `${month}-01`,
    to: lastDayOfMonth(month),
    label: `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}.`,
    anchor: month,
  };
}

// Dnevni iznosi iz baze -> stubići po danu (do ~2 meseca), mesecu (do 3 godine) ili godini; i dani bez prihoda.
function toBuckets(daily, from, to) {
  const span = daysBetween(from, to) + 1;
  const unit = span <= 62 ? 'day' : span <= 1100 ? 'month' : 'year';
  const keyOf = (day) => (unit === 'day' ? day : unit === 'month' ? day.slice(0, 7) : day.slice(0, 4));
  const buckets = new Map();
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const key = keyOf(day);
    if (!buckets.has(key)) {
      const label =
        unit === 'day'
          ? `${Number(day.slice(8))}.`
          : unit === 'month'
            ? `${SHORT_MONTHS[Number(day.slice(5, 7)) - 1]}${span > 366 ? ` ${day.slice(2, 4)}` : ''}`
            : day.slice(0, 4);
      const fullLabel =
        unit === 'day' ? formatDate(day) : unit === 'month' ? `${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}.` : `${day.slice(0, 4)}.`;
      buckets.set(key, { key, label, fullLabel, rental: 0, extras: 0 });
    }
    if (unit !== 'day') {
      // Preskoči na prvi dan sledećeg meseca/godine (brže od dan-po-dan za duge periode).
      const next = unit === 'month' ? `${shiftMonth(day.slice(0, 7), 1)}-01` : `${Number(day.slice(0, 4)) + 1}-01-01`;
      day = addDays(next, -1);
    }
  }
  daily.forEach((d) => {
    const bucket = buckets.get(keyOf(d.day));
    if (bucket) {
      bucket.rental += Number(d.rental);
      bucket.extras += Number(d.extras);
    }
  });
  return [...buckets.values()];
}

// 2, 3, 4 rezervacije; 5–20 rezervacija; 21 rezervacija...
function reservationsWord(n) {
  const lastTwo = n % 100;
  const last = n % 10;
  if (last === 1 && lastTwo !== 11) return 'rezervacija';
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'rezervacije';
  return 'rezervacija';
}

// 0.333 -> "33,3%"
function formatPercent(share) {
  return `${(Math.round(share * 1000) / 10).toLocaleString('sr-RS')}%`;
}

const roundCents = (amount) => Math.round(amount * 100) / 100;

function Stat({ label, value, sub }) {
  return (
    <div className="admin-stat">
      <span className="admin-stat__value">{value}</span>
      <span className="admin-stat__label">{label}</span>
      {sub && <span className="admin-stat__sub">{sub}</span>}
    </div>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const today = todayBelgrade();
  const periodType = PERIODS[params.get('period')] ? params.get('period') : 'mesec';
  const mode = MODES[params.get('prikaz')] ? params.get('prikaz') : 'rental';
  const scope = SCOPES[params.get('obuhvat')] ? params.get('obuhvat') : 'booked';
  const carId = params.get('vozilo') ?? '';
  const { from, to, label, anchor } = periodRange(periodType, params, today);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: true });
  };

  const { data: loaded, error, loading, reload } = useAdminData(
    () =>
      Promise.all([adminApi.revenue({ from, to, mode, scope, carId }), adminApi.fleetUsage({ from, to, scope, carId })]).then(
        ([revenue, usage]) => ({ ...revenue, usage }),
      ),
    [from, to, mode, scope, carId],
  );
  // Podaci za drugo vozilo (ili celu flotu) se ne prikazuju dok stižu novi — inače bi
  // se na trenutak videlo "nema prihod". Za promenu perioda stari podaci ostaju (prigušeno).
  const data = loaded && (loaded.car_id ?? '') === carId ? loaded : null;

  const shiftPeriod = (direction) => {
    if (periodType === 'dan') update({ datum: addDays(anchor, direction) });
    else if (periodType === 'mesec') update({ mesec: shiftMonth(anchor, direction) });
    else if (periodType === 'godina') update({ godina: String(Number(anchor) + direction) });
  };

  const car = carId ? vehicleById(carId) : null;
  const carName = car?.name ?? data?.by_car?.[0]?.car_name ?? carId;
  const totals = data?.totals;
  const average = totals && totals.reservations > 0 ? totals.total / totals.reservations : null;
  const buckets = data ? toBuckets(data.daily, from, to) : [];

  // Sva vozila iz ponude (i ona bez prihoda) + vozila koja više nisu u ponudi, a imaju prihod.
  const byCar = new Map((data?.by_car ?? []).map((c) => [c.car_id, c]));
  const carRows = [
    ...FLEET_ORDER.map((c) => byCar.get(c.id) ?? { car_id: c.id, car_name: c.name, reservations: 0, rental: 0, extras: 0, total: 0 }),
    ...(data?.by_car ?? []).filter((c) => !FLEET_ORDER.some((f) => f.id === c.car_id)),
  ]
    .map((c) => ({ ...c, car_name: vehicleById(c.car_id)?.name ?? c.car_name }))
    .sort((a, b) => b.total - a.total || a.car_name.localeCompare(b.car_name, 'sr'));
  const maxCarTotal = Math.max(...carRows.map((c) => c.total), 0);

  // Iskorišćenost: svako vozilo je dostupno svih dana perioda; dani u najmu i
  // prihod tih dana stižu iz baze (admin_fleet_usage).
  const periodDays = data?.usage.period_days ?? 0;
  const usageByCar = new Map((data?.usage.cars ?? []).map((c) => [c.car_id, c]));
  const usageRows = (carId ? carRows.filter((c) => c.car_id === carId) : carRows)
    .map((c) => {
      const u = usageByCar.get(c.car_id) ?? { rented_days: 0, priced_days: 0, revenue: 0 };
      return {
        car_id: c.car_id,
        car_name: c.car_name,
        rented: u.rented_days,
        free: periodDays - u.rented_days,
        utilization: periodDays ? u.rented_days / periodDays : 0,
        adr: u.priced_days ? Number(u.revenue) / u.priced_days : null,
        pricedDays: u.priced_days,
        revenue: Number(u.revenue),
      };
    })
    .sort((a, b) => b.utilization - a.utilization || a.car_name.localeCompare(b.car_name, 'sr'));
  const fleetRented = usageRows.reduce((s, r) => s + r.rented, 0);
  const fleetAvailable = periodDays * usageRows.length;
  const fleetPricedDays = usageRows.reduce((s, r) => s + r.pricedDays, 0);
  const fleetAdr = fleetPricedDays ? usageRows.reduce((s, r) => s + r.revenue, 0) / fleetPricedDays : null;
  const fleetUtilization = fleetAvailable ? fleetRented / fleetAvailable : 0;

  return (
    <div className="admin-page">
      {carId && (
        <button type="button" className="admin-link admin-back" onClick={() => update({ vozilo: null })}>
          ← Sva vozila
        </button>
      )}
      <div className="admin-page__header">
        <div>
          <h1>{carId ? `Analitika: ${carName}` : 'Analitika prihoda'}</h1>
          <p className="admin-muted">
            {label} · {SCOPES[scope].label} ({SCOPES[scope].hint})
          </p>
        </div>
      </div>

      <div className="admin-panel admin-analytics-filters">
        <div className="admin-analytics-filters__row">
          <div className="admin-cal-toolbar__views" role="group" aria-label="Period">
            {Object.entries(PERIODS).map(([key, text]) => (
              <button
                key={key}
                type="button"
                className={`admin-chip${periodType === key ? ' admin-chip--on' : ''}`}
                aria-pressed={periodType === key}
                onClick={() => update({ period: key === 'mesec' ? null : key })}
              >
                {text}
              </button>
            ))}
          </div>
          <div className="admin-analytics-filters__period">
            {periodType !== 'raspon' && (
              <button type="button" className="admin-btn admin-btn--small" aria-label="Prethodni period" onClick={() => shiftPeriod(-1)}>
                ←
              </button>
            )}
            {periodType === 'dan' && (
              <input type="date" aria-label="Dan" value={anchor} onChange={(e) => update({ datum: e.target.value })} />
            )}
            {periodType === 'mesec' && (
              <input type="month" aria-label="Mesec" value={anchor} onChange={(e) => update({ mesec: e.target.value })} />
            )}
            {periodType === 'godina' && (
              <input
                type="number"
                aria-label="Godina"
                min="2020"
                max="2100"
                value={anchor}
                onChange={(e) => /^\d{4}$/.test(e.target.value) && update({ godina: e.target.value })}
              />
            )}
            {periodType === 'raspon' && (
              <>
                <input type="date" aria-label="Od" value={from} onChange={(e) => update({ od: e.target.value })} />
                <span className="admin-muted">do</span>
                <input type="date" aria-label="Do" value={to} min={from} onChange={(e) => update({ do: e.target.value })} />
              </>
            )}
            {periodType !== 'raspon' && (
              <button type="button" className="admin-btn admin-btn--small" aria-label="Sledeći period" onClick={() => shiftPeriod(1)}>
                →
              </button>
            )}
          </div>
          <label className="admin-field admin-analytics-filters__car">
            <span className="admin-visually-hidden">Vozilo</span>
            <select value={carId} onChange={(e) => update({ vozilo: e.target.value })}>
              <option value="">Sva vozila</option>
              {FLEET_ORDER.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-analytics-filters__row">
          <div className="admin-cal-toolbar__views" role="group" aria-label="Način prikaza">
            {Object.entries(MODES).map(([key, m]) => (
              <button
                key={key}
                type="button"
                className={`admin-chip${mode === key ? ' admin-chip--on' : ''}`}
                aria-pressed={mode === key}
                onClick={() => update({ prikaz: key === 'rental' ? null : key })}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="admin-cal-toolbar__views" role="group" aria-label="Obuhvat">
            {Object.entries(SCOPES).map(([key, s]) => (
              <button
                key={key}
                type="button"
                className={`admin-chip${scope === key ? ' admin-chip--on' : ''}`}
                aria-pressed={scope === key}
                onClick={() => update({ obuhvat: key === 'booked' ? null : key })}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <p className="admin-muted admin-hint">
          {MODES[mode].hint} Otkazane i „nije se pojavio“ se ne računaju; povraćaji umanjuju prihod.
        </p>
      </div>

      {!data && loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && (
        <div className={loading ? 'admin-table-wrap--loading admin-analytics' : 'admin-analytics'}>
          {data.unpriced > 0 && (
            <div className="admin-alert admin-alert--warning">
              {data.unpriced === 1
                ? '1 rezervacija u ovom periodu nema poznatu cenu i nije uračunata. Otvori je u listi rezervacija i upiši cenu preko „Izmeni“.'
                : `${data.unpriced} ${reservationsWord(data.unpriced)} u ovom periodu nemaju poznatu cenu i nisu uračunate. Otvori ih u listi rezervacija i upiši cenu preko „Izmeni“.`}
            </div>
          )}

          <div className="admin-stats admin-stats--5">
            <Stat label="Ukupan prihod" value={formatMoney(totals.total)} />
            <Stat label="Prihod od najma" value={formatMoney(totals.rental)} />
            <Stat label="Prihod od dodataka" value={formatMoney(totals.extras)} />
            <Stat label={scope === 'realized' ? 'Realizovanih rezervacija' : 'Rezervacija'} value={totals.reservations} />
            <Stat label="Prosek po rezervaciji" value={average === null ? '—' : formatMoney(roundCents(average))} />
          </div>

          <div className="admin-panel admin-cash">
            <div>
              <h2 className="admin-panel__title">Naplaćeno u periodu</h2>
              <p className="admin-muted admin-hint">
                Stvarno zabeležene uplate po datumu uplate (ručni unos u rezervaciji) — nije isto što i vrednost
                rezervacija iznad.
              </p>
            </div>
            <div className="admin-money">
              <div>
                <span className="admin-muted">Uplate</span>
                <strong>{formatMoney(data.cash.received)}</strong>
              </div>
              <div>
                <span className="admin-muted">Povraćaji</span>
                <strong>{formatMoney(data.cash.refunded)}</strong>
              </div>
              <div>
                <span className="admin-muted">Naplaćeno neto</span>
                <strong>{formatMoney(data.cash.collected)}</strong>
              </div>
            </div>
          </div>

          <section className="admin-panel">
            <h2 className="admin-panel__title">{carId ? 'Iskorišćenost vozila' : 'Iskorišćenost flote'}</h2>
            <div className="admin-stats">
              <Stat
                label="Iskorišćenost"
                value={formatPercent(fleetUtilization)}
                sub={`${carId ? 'vozilo' : `${usageRows.length} vozila`} × ${periodDays} ${periodDays === 1 ? 'dan' : 'dana'}`}
              />
              <Stat label="Dani u najmu" value={fleetRented} sub={`od ${fleetAvailable} mogućih`} />
              <Stat label="Slobodni dani" value={fleetAvailable - fleetRented} />
              <Stat
                label="ADR — prosečna zarada po danu najma"
                value={fleetAdr === null ? '—' : formatMoney(roundCents(fleetAdr))}
                sub="najam + dodaci / dani u najmu"
              />
            </div>
            <p className="admin-muted admin-hint">
              Računa se po danima najma (od dana preuzimanja do dana pre vraćanja), bez obzira na izabrani prikaz prihoda.
              Rezervacije bez poznate cene zauzimaju vozilo, ali ne ulaze u ADR.
            </p>
          </section>

          {buckets.length > 1 && (
            <section className="admin-panel">
              <h2 className="admin-panel__title">Prihod kroz vreme · {MODES[mode].label.toLowerCase()}</h2>
              <RevenueChart buckets={buckets} title={`Prihod ${label}`} />
              <details className="admin-chart-table">
                <summary>Prikaži kao tabelu</summary>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Najam</th>
                        <th>Dodaci</th>
                        <th>Ukupno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buckets
                        .filter((b) => b.rental + b.extras > 0)
                        .map((b) => (
                          <tr key={b.key}>
                            <td>{b.fullLabel}</td>
                            <td>{formatMoney(b.rental)}</td>
                            <td>{formatMoney(b.extras)}</td>
                            <td>
                              <strong>{formatMoney(b.rental + b.extras)}</strong>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
          )}

          {!carId && (
            <section className="admin-panel">
              <h2 className="admin-panel__title">Prihod po automobilima</h2>
              <div className="admin-table-wrap">
                <table className="admin-table admin-table--responsive">
                  <thead>
                    <tr>
                      <th>Vozilo</th>
                      <th>Rezervacija</th>
                      <th>Najam</th>
                      <th>Dodaci</th>
                      <th>Ukupno</th>
                      <th>Prosek po rez.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carRows.map((c) => (
                      <tr key={c.car_id} className="admin-row" onClick={() => update({ vozilo: c.car_id })}>
                        <td data-label="Vozilo">
                          <div>
                            <button type="button" className="admin-link" onClick={() => update({ vozilo: c.car_id })}>
                              {c.car_name}
                            </button>
                          </div>
                        </td>
                        <td data-label="Rezervacija">
                          <div>{c.reservations}</div>
                        </td>
                        <td data-label="Najam">
                          <div className="admin-nowrap">{formatMoney(c.rental)}</div>
                        </td>
                        <td data-label="Dodaci">
                          <div className="admin-nowrap">{formatMoney(c.extras)}</div>
                        </td>
                        <td data-label="Ukupno">
                          <div className="admin-total-bar">
                            <strong className="admin-nowrap">{formatMoney(c.total)}</strong>
                            <span className="admin-total-bar__track" aria-hidden="true">
                              <span style={{ width: maxCarTotal ? `${(c.total / maxCarTotal) * 100}%` : 0 }} />
                            </span>
                          </div>
                        </td>
                        <td data-label="Prosek po rez.">
                          <div className="admin-nowrap">
                            {c.reservations ? formatMoney(roundCents(c.total / c.reservations)) : '—'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td data-label="Vozilo">
                        <div>
                          <strong>Cela flota</strong>
                        </div>
                      </td>
                      <td data-label="Rezervacija">
                        <div>{totals.reservations}</div>
                      </td>
                      <td data-label="Najam">
                        <div className="admin-nowrap">{formatMoney(totals.rental)}</div>
                      </td>
                      <td data-label="Dodaci">
                        <div className="admin-nowrap">{formatMoney(totals.extras)}</div>
                      </td>
                      <td data-label="Ukupno">
                        <div className="admin-nowrap">
                          <strong>{formatMoney(totals.total)}</strong>
                        </div>
                      </td>
                      <td data-label="Prosek po rez.">
                        <div className="admin-nowrap">{average === null ? '—' : formatMoney(roundCents(average))}</div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}

          {!carId && (
            <section className="admin-panel">
              <h2 className="admin-panel__title">Iskorišćenost po automobilima</h2>
              <div className="admin-table-wrap">
                <table className="admin-table admin-table--responsive">
                  <thead>
                    <tr>
                      <th>Vozilo</th>
                      <th>Dani u najmu</th>
                      <th>Slobodni dani</th>
                      <th>Iskorišćenost</th>
                      <th>ADR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageRows.map((u) => (
                      <tr key={u.car_id} className="admin-row" onClick={() => update({ vozilo: u.car_id })}>
                        <td data-label="Vozilo">
                          <div>
                            <button type="button" className="admin-link" onClick={() => update({ vozilo: u.car_id })}>
                              {u.car_name}
                            </button>
                          </div>
                        </td>
                        <td data-label="Dani u najmu">
                          <div>{u.rented}</div>
                        </td>
                        <td data-label="Slobodni dani">
                          <div>{u.free}</div>
                        </td>
                        <td data-label="Iskorišćenost">
                          <div className="admin-total-bar">
                            <strong className="admin-nowrap">{formatPercent(u.utilization)}</strong>
                            <span className="admin-total-bar__track" aria-hidden="true">
                              <span style={{ width: `${Math.min(u.utilization, 1) * 100}%` }} />
                            </span>
                          </div>
                        </td>
                        <td data-label="ADR">
                          <div className="admin-nowrap">{u.adr === null ? '—' : formatMoney(roundCents(u.adr))}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td data-label="Vozilo">
                        <div>
                          <strong>Cela flota</strong>
                        </div>
                      </td>
                      <td data-label="Dani u najmu">
                        <div>{fleetRented}</div>
                      </td>
                      <td data-label="Slobodni dani">
                        <div>{fleetAvailable - fleetRented}</div>
                      </td>
                      <td data-label="Iskorišćenost">
                        <div>
                          <strong>{formatPercent(fleetUtilization)}</strong>
                        </div>
                      </td>
                      <td data-label="ADR">
                        <div className="admin-nowrap">{fleetAdr === null ? '—' : formatMoney(roundCents(fleetAdr))}</div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}

          {carId && (
            <section className="admin-panel">
              <h2 className="admin-panel__title">Rezervacije u periodu</h2>
              {data.reservations.length === 0 ? (
                <p className="admin-muted">Ovo vozilo nema prihod u izabranom periodu.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table admin-table--responsive">
                    <thead>
                      <tr>
                        <th>Kupac</th>
                        <th>Termin</th>
                        <th>Status</th>
                        <th>Najam u periodu</th>
                        <th>Dodaci u periodu</th>
                        <th>Iznos rezervacije</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.reservations.map((r) => (
                        <tr key={r.id} className="admin-row" onClick={() => navigate(`/rezervacije/${r.id}`)}>
                          <td data-label="Kupac">
                            <div>
                              <Link to={`/rezervacije/${r.id}`} onClick={(e) => e.stopPropagation()} className="admin-link">
                                {r.customer_name}
                              </Link>
                            </div>
                          </td>
                          <td data-label="Termin">
                            <div className="admin-nowrap">
                              {formatDate(r.pickup_date)} → {formatDate(r.return_date)}
                            </div>
                          </td>
                          <td data-label="Status">
                            <div>
                              <StatusBadge status={r.status} />
                            </div>
                          </td>
                          <td data-label="Najam u periodu">
                            <div className="admin-nowrap">{formatMoney(r.rental)}</div>
                          </td>
                          <td data-label="Dodaci u periodu">
                            <div className="admin-nowrap">{formatMoney(r.extras)}</div>
                          </td>
                          <td data-label="Iznos rezervacije">
                            <div className="admin-nowrap">{formatMoney(r.total_price)}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
