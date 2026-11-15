import { Fragment, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ErrorState, LoadingState } from '../components/States';
import { adminApi, useAdminData } from '../lib/adminApi';
import { addDays, daysBetween, formatDate, formatTime, todayBelgrade } from '../lib/format';
import { ACTIVE_STATUSES, FLEET_ORDER, MONTHS, STATUS_ORDER, STATUSES, WEEKDAYS } from '../lib/labels';
import { RENTAL_HOURS } from '../../data/rental';
import { minutesAt, reservationSpan, spansOverlap } from '../../lib/rentalTimes';

const VIEWS = { dan: 'Dan', nedelja: 'Nedelja', mesec: 'Mesec' };

// Prikaz "Dan": sati od 06 do 22 (preuzimanje od 08, vraćanje do 20 + 2 h pripreme).
const DAY_FROM_HOUR = 6;
const DAY_TO_HOUR = 22;

const weekdayOf = (day) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
// Naziv bez marke za usku kolonu na telefonu: "Volkswagen Golf 7" -> "Golf 7".
const shortName = (name) => name.split(' ').slice(1).join(' ') || name;
const hourLabel = (hour) => `${String(hour).padStart(2, '0')}:00`;

// Prikazani period: jedan dan, nedelja od ponedeljka ili ceo mesec.
function rangeFor(view, anchor) {
  if (view === 'dan') return { from: anchor, to: anchor };
  if (view === 'nedelja') {
    const from = addDays(anchor, -weekdayOf(anchor));
    return { from, to: addDays(from, 6) };
  }
  const [y, m] = anchor.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${anchor.slice(0, 7)}-01`, to: `${anchor.slice(0, 7)}-${String(last).padStart(2, '0')}` };
}

function shiftAnchor(view, anchor, direction) {
  if (view === 'dan') return addDays(anchor, direction);
  if (view === 'nedelja') return addDays(anchor, 7 * direction);
  const [y, m] = anchor.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + direction, 1)).toISOString().slice(0, 10);
}

function periodTitle(view, from, to) {
  if (view === 'mesec') return `${MONTHS[Number(from.slice(5, 7)) - 1]} ${from.slice(0, 4)}`;
  if (view === 'dan') return `${WEEKDAYS[weekdayOf(from)]} ${formatDate(from)}`;
  return `${formatDate(from)} – ${formatDate(to)}`;
}

// Kolone prikaza: sati jednog dana ili dani perioda. start/unit su u minutima
// (kao reservationSpan), pa se trake crtaju tačno po vremenu.
function columnsFor(view, from, to) {
  if (view === 'dan') {
    return {
      start: minutesAt(from, hourLabel(DAY_FROM_HOUR)),
      unit: 60,
      items: Array.from({ length: DAY_TO_HOUR - DAY_FROM_HOUR }, (_, i) => ({ key: i, hour: DAY_FROM_HOUR + i, day: from })),
    };
  }
  return {
    start: minutesAt(from),
    unit: 1440,
    items: Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => ({ key: i, day: addDays(from, i) })),
  };
}

// Trake jednog vozila: od vremena preuzimanja do vremena vraćanja (bez vremena
// — cele dane), odsečene na prikazani period. Posle vraćanja aktivne
// rezervacije ide 2 h pripreme. Preklopljene trake idu u posebne redove (lanes).
function layoutBars(rows, columns) {
  const viewStart = columns.start;
  const viewEnd = columns.start + columns.items.length * columns.unit;
  const pos = (minute) => (Math.min(Math.max(minute, viewStart), viewEnd) - viewStart) / columns.unit;
  const sorted = rows
    .map((r) => {
      const span = reservationSpan(r);
      const active = ACTIVE_STATUSES.includes(r.status);
      const prep = r.return_time && active ? RENTAL_HOURS.bufferMinutes : 0;
      return { ...r, start: span.start, end: r.return_time ? span.end - RENTAL_HOURS.bufferMinutes : span.end, prep };
    })
    .filter((r) => r.start < viewEnd && r.end + r.prep > viewStart)
    .sort((a, b) => a.start - b.start);
  const laneEnds = [];
  const bars = sorted.map((r) => {
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= r.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = r.end + r.prep;
    return {
      ...r,
      offset: pos(r.start),
      length: pos(r.end) - pos(r.start),
      prepOffset: pos(r.end),
      prepLength: pos(r.end + r.prep) - pos(r.end),
      lane,
      clippedStart: r.start < viewStart,
      clippedEnd: r.end > viewEnd,
    };
  });
  return { bars, lanes: Math.max(1, laneEnds.length) };
}

// Dve aktivne rezervacije istog vozila čiji se termini preklapaju (vreme + 2 h
// pripreme, isto pravilo kao u bazi). Baza to ne dozvoljava, pa bi ovo trebalo
// da bude uvek prazno — ali ako se ikad desi, mora odmah da se vidi.
function findConflicts(rows) {
  const active = rows.filter((r) => ACTIVE_STATUSES.includes(r.status)).map((r) => ({ ...r, span: reservationSpan(r) }));
  const ids = new Set();
  active.forEach((a, i) =>
    active.slice(i + 1).forEach((b) => {
      if (a.car_id === b.car_id && spansOverlap(a.span, b.span)) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }),
  );
  return ids;
}

function barLabel(view, bar) {
  if (view === 'mesec') return bar.customer_name;
  const from = bar.clippedStart ? '…' : formatTime(bar.pickup_time) || 'ceo dan';
  const to = bar.clippedEnd ? '…' : formatTime(bar.return_time) || 'ceo dan';
  return `${bar.customer_name} · ${from} – ${to}`;
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

  const columns = useMemo(() => columnsFor(view, from, to), [view, from, to]);

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
  const columnClass = (base, column) => {
    const weekend = view !== 'dan' && weekdayOf(column.day) >= 5;
    const isToday = view !== 'dan' && column.day === today;
    return `${base}${weekend ? ` ${base}--weekend` : ''}${isToday ? ` ${base}--today` : ''}`;
  };

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
          <div className={`admin-cal admin-cal--${view}`} style={{ '--days': columns.items.length }}>
            <div className="admin-cal__row admin-cal__row--head">
              <div className="admin-cal__car">Vozilo</div>
              <div className="admin-cal__track admin-cal__track--head">
                {columns.items.map((column, i) => (
                  <div key={column.key} className={columnClass('admin-cal__day', column)} style={{ '--i': i }}>
                    {view === 'dan' ? (
                      <strong>{hourLabel(column.hour)}</strong>
                    ) : (
                      <>
                        <span>{WEEKDAYS[weekdayOf(column.day)]}</span>
                        <strong>{Number(column.day.slice(8))}</strong>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {vehicles.map((car) => {
              const { bars, lanes } = layoutBars(
                visibleRows.filter((r) => r.car_id === car.id),
                columns,
              );
              return (
                <div key={car.id} className="admin-cal__row">
                  <div className="admin-cal__car" title={car.name}>
                    <strong>
                      <span className="admin-cal__car-full">{car.name}</span>
                      <span className="admin-cal__car-short" aria-hidden="true">
                        {shortName(car.name)}
                      </span>
                    </strong>
                    {plates[car.id] && <span className="admin-muted">{plates[car.id]}</span>}
                    {car.unknown && <span className="admin-muted">nije u ponudi</span>}
                  </div>
                  <div className="admin-cal__track" style={{ '--lanes': lanes }}>
                    {columns.items.map((column, i) => (
                      <button
                        key={column.key}
                        type="button"
                        tabIndex={-1}
                        className={columnClass('admin-cal__cell', column)}
                        style={{ '--i': i }}
                        title={car.unknown ? undefined : `Nova rezervacija: ${car.name}, ${formatDate(column.day)}`}
                        disabled={car.unknown}
                        onClick={() => navigate(`/rezervacije/nova?vozilo=${encodeURIComponent(car.id)}&od=${column.day}`)}
                      />
                    ))}
                    {view === 'dan' && bars.length === 0 && !car.unknown && (
                      <span className="admin-cal__free">Slobodno ceo dan</span>
                    )}
                    {bars.map((bar) => (
                      <Fragment key={bar.id}>
                        {bar.prepLength > 0 && (
                          <span
                            className="admin-cal__prep"
                            style={{ '--start': bar.prepOffset, '--len': bar.prepLength, '--lane': bar.lane }}
                            title="2 h pripreme posle vraćanja"
                            aria-hidden="true"
                          />
                        )}
                        {bar.length > 0 && (
                          <Link
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
                            {barLabel(view, bar)}
                          </Link>
                        )}
                      </Fragment>
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
        <span>
          <i className="admin-cal__swatch admin-cal__swatch--prep" />
          Priprema 2 h
        </span>
        <span className="admin-muted">
          Traka ide od vremena preuzimanja do vremena vraćanja; posle vraćanja vozilo je 2 h u pripremi. Rezervacija bez
          upisanog vremena zauzima cele dane. Klik na prazno polje = nova rezervacija.
        </span>
      </div>
    </div>
  );
}
