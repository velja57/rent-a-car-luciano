import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ErrorState, LoadingState } from '../components/States';
import { adminApi, useAdminData } from '../lib/adminApi';
import { addDays, daysBetween, formatDate, formatTime, todayBelgrade } from '../lib/format';
import { ACTIVE_STATUSES, FLEET_ORDER, MONTHS, STATUS_ORDER, STATUSES, WEEKDAYS } from '../lib/labels';

const VIEWS = { mesec: 'Mesec', '2ned': '2 nedelje' };

// Prikazani period: ceo mesec ili 14 dana od ponedeljka.
function rangeFor(view, anchor) {
  if (view === '2ned') {
    const weekday = (new Date(`${anchor}T00:00:00Z`).getUTCDay() + 6) % 7;
    const from = addDays(anchor, -weekday);
    return { from, to: addDays(from, 13) };
  }
  const [y, m] = anchor.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${anchor.slice(0, 7)}-01`, to: `${anchor.slice(0, 7)}-${String(last).padStart(2, '0')}` };
}

function shiftAnchor(view, anchor, direction) {
  if (view === '2ned') return addDays(anchor, 14 * direction);
  const [y, m] = anchor.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + direction, 1)).toISOString().slice(0, 10);
}

function periodTitle(view, from, to) {
  if (view === 'mesec') return `${MONTHS[Number(from.slice(5, 7)) - 1]} ${from.slice(0, 4)}`;
  return `${formatDate(from)} – ${formatDate(to)}`;
}

// Trake jednog vozila: odsečene na prikazani period, raspoređene u "trake"
// (lanes) tako da se preklopljene ne crtaju jedna preko druge. Dan vraćanja
// je uključen, isto kao u bazi.
function layoutBars(rows, from, to) {
  const sorted = [...rows].sort((a, b) => a.pickup_date.localeCompare(b.pickup_date));
  const laneEnds = [];
  const bars = sorted.map((r) => {
    const start = r.pickup_date < from ? from : r.pickup_date;
    const end = r.return_date > to ? to : r.return_date;
    let lane = laneEnds.findIndex((laneEnd) => laneEnd < start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end;
    return {
      ...r,
      offset: daysBetween(from, start),
      length: daysBetween(start, end) + 1,
      lane,
      clippedStart: r.pickup_date < from,
      clippedEnd: r.return_date > to,
    };
  });
  return { bars, lanes: Math.max(1, laneEnds.length) };
}

// Dve aktivne rezervacije istog vozila sa preklopljenim danima. Baza to ne
// dozvoljava, pa bi ovo trebalo da bude uvek prazno — ali ako se ikad desi,
// mora odmah da se vidi.
function findConflicts(rows) {
  const active = rows.filter((r) => ACTIVE_STATUSES.includes(r.status));
  const ids = new Set();
  active.forEach((a, i) =>
    active.slice(i + 1).forEach((b) => {
      if (a.car_id === b.car_id && a.pickup_date <= b.return_date && b.pickup_date <= a.return_date) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }),
  );
  return ids;
}

export default function Calendar() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const today = todayBelgrade();
  const view = VIEWS[params.get('prikaz')] ? params.get('prikaz') : 'mesec';
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(params.get('od') ?? '') ? params.get('od') : today;
  const showInactive = params.get('otkazane') === '1';
  const { from, to } = rangeFor(view, anchor);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: true });
  };

  const { data, error, loading, reload } = useAdminData(() => adminApi.calendar(from, to), [from, to]);
  const registry = useAdminData(() => adminApi.listVehicles(), []);

  const days = useMemo(() => Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i)), [from, to]);

  const allRows = data?.rows ?? [];
  const conflicts = useMemo(() => findConflicts(allRows), [allRows]);
  const visibleRows = showInactive ? allRows : allRows.filter((r) => ACTIVE_STATUSES.includes(r.status));

  // Redovi: vozila iz ponude redom kao na sajtu + vozila koja više nisu u ponudi, a imaju rezervacije.
  const plates = Object.fromEntries((registry.data ?? []).map((v) => [v.car_id, v.registration]));
  const vehicles = [
    ...FLEET_ORDER.map((car) => ({ id: car.id, name: car.name })),
    ...[...new Map(allRows.filter((r) => !FLEET_ORDER.some((c) => c.id === r.car_id)).map((r) => [r.car_id, r.car_name]))].map(
      ([id, name]) => ({ id, name, unknown: true }),
    ),
  ];

  const activeCount = allRows.filter((r) => ACTIVE_STATUSES.includes(r.status)).length;

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1>Kalendar vozila</h1>
          <p className="admin-muted">
            {periodTitle(view, from, to)} · aktivnih rezervacija u periodu: {data ? activeCount : '…'}
          </p>
        </div>
        <Link to="/rezervacije/nova" className="admin-btn admin-btn--accent">
          + Nova rezervacija
        </Link>
      </div>

      <div className="admin-panel admin-cal-toolbar">
        <div className="admin-cal-toolbar__nav">
          <button type="button" className="admin-btn admin-btn--small" onClick={() => update({ od: shiftAnchor(view, anchor, -1) })}>
            ← Prethodni
          </button>
          <button type="button" className="admin-btn admin-btn--small" onClick={() => update({ od: null })}>
            Danas
          </button>
          <button type="button" className="admin-btn admin-btn--small" onClick={() => update({ od: shiftAnchor(view, anchor, 1) })}>
            Sledeći →
          </button>
        </div>
        <div className="admin-cal-toolbar__views" role="group" aria-label="Prikaz">
          {Object.entries(VIEWS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`admin-chip${view === key ? ' admin-chip--on' : ''}`}
              aria-pressed={view === key}
              onClick={() => update({ prikaz: key === 'mesec' ? null : key })}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="admin-check">
          <input type="checkbox" checked={showInactive} onChange={(e) => update({ otkazane: e.target.checked ? '1' : null })} />
          <span>Prikaži otkazane i „nije se pojavio“</span>
        </label>
      </div>

      {conflicts.size > 0 && (
        <div className="admin-alert" role="alert">
          <strong>Pažnja: preklapanje rezervacija!</strong> Neke aktivne rezervacije istog vozila se preklapaju (označene
          crveno). Otvori ih i promeni datume ili vozilo.
        </div>
      )}

      {!data && loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && (
        <div className={`admin-cal-wrap${loading ? ' admin-table-wrap--loading' : ''}`}>
          <div className={`admin-cal admin-cal--${view}`} style={{ '--days': days.length }}>
            <div className="admin-cal__row admin-cal__row--head">
              <div className="admin-cal__car">Vozilo</div>
              <div className="admin-cal__track admin-cal__track--head">
                {days.map((day, i) => {
                  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
                  return (
                    <div
                      key={day}
                      className={`admin-cal__day${weekday >= 5 ? ' admin-cal__day--weekend' : ''}${day === today ? ' admin-cal__day--today' : ''}`}
                      style={{ '--i': i }}
                    >
                      <span>{WEEKDAYS[weekday]}</span>
                      <strong>{Number(day.slice(8))}</strong>
                    </div>
                  );
                })}
              </div>
            </div>

            {vehicles.map((car) => {
              const { bars, lanes } = layoutBars(
                visibleRows.filter((r) => r.car_id === car.id),
                from,
                to,
              );
              return (
                <div key={car.id} className="admin-cal__row">
                  <div className="admin-cal__car" title={car.name}>
                    <strong>{car.name}</strong>
                    {plates[car.id] && <span className="admin-muted">{plates[car.id]}</span>}
                    {car.unknown && <span className="admin-muted">nije u ponudi</span>}
                  </div>
                  <div className="admin-cal__track" style={{ '--lanes': lanes }}>
                    {days.map((day, i) => {
                      const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
                      return (
                        <button
                          key={day}
                          type="button"
                          tabIndex={-1}
                          className={`admin-cal__cell${weekday >= 5 ? ' admin-cal__cell--weekend' : ''}${day === today ? ' admin-cal__cell--today' : ''}`}
                          style={{ '--i': i }}
                          title={car.unknown ? undefined : `Nova rezervacija: ${car.name}, ${formatDate(day)}`}
                          disabled={car.unknown}
                          onClick={() => navigate(`/rezervacije/nova?vozilo=${encodeURIComponent(car.id)}&od=${day}`)}
                        />
                      );
                    })}
                    {bars.map((bar) => (
                      <Link
                        key={bar.id}
                        to={`/rezervacije/${bar.id}`}
                        className={[
                          'admin-cal__bar',
                          `admin-cal__bar--${bar.status}`,
                          conflicts.has(bar.id) && 'admin-cal__bar--conflict',
                          bar.clippedStart && 'admin-cal__bar--clip-start',
                          bar.clippedEnd && 'admin-cal__bar--clip-end',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={{ '--start': bar.offset, '--len': bar.length, '--lane': bar.lane }}
                        title={`${bar.customer_name} · ${formatDate(bar.pickup_date)}${bar.pickup_time ? ` ${formatTime(bar.pickup_time)}` : ''} – ${formatDate(bar.return_date)}${bar.return_time ? ` ${formatTime(bar.return_time)}` : ''} · ${STATUSES[bar.status]}`}
                      >
                        {bar.customer_name}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="admin-cal-legend">
        {STATUS_ORDER.filter((s) => showInactive || ACTIVE_STATUSES.includes(s)).map((status) => (
          <span key={status}>
            <i className={`admin-cal__swatch admin-cal__bar--${status}`} />
            {STATUSES[status]}
          </span>
        ))}
        <span className="admin-muted">
          Traka obuhvata i dan vraćanja (tog dana se vozilo ne izdaje drugom kupcu). Klik na prazan dan = nova rezervacija.
        </span>
      </div>
    </div>
  );
}
