import { useEffect } from 'react';
import { Link } from 'react-router';
import StatusBadge from '../components/StatusBadge';
import { ErrorState, LoadingState } from '../components/States';
import { adminApi, useAdminData } from '../lib/adminApi';
import { formatDate, formatDateTime, formatTime, todayBelgrade } from '../lib/format';
import { FLEET_ORDER, STATUS_ORDER, STATUSES, vehicleById } from '../lib/labels';

// Vreme iz baze (UTC) -> "14:32" po beogradskom vremenu.
const clock = (timestamp) => formatDateTime(timestamp).slice(-5);

function Stat({ value, label, to }) {
  const body = (
    <>
      <span className="admin-stat__value">{value}</span>
      <span className="admin-stat__label">{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className="admin-stat admin-stat--link">
      {body}
    </Link>
  ) : (
    <div className="admin-stat">{body}</div>
  );
}

// Šta je sa današnjim preuzimanjem / vraćanjem: čeka ili je obavljeno (i kada).
function dayState(r, kind) {
  if (kind === 'pickup') {
    if (r.status === 'confirmed') return { text: 'Čeka preuzimanje', done: false };
    return { text: r.picked_up_at ? `Preuzeto u ${clock(r.picked_up_at)}` : 'Preuzeto', done: true };
  }
  if (r.status === 'completed') return { text: r.returned_at ? `Vraćeno u ${clock(r.returned_at)}` : 'Vraćeno', done: true };
  if (r.status === 'picked_up') return { text: 'Čeka vraćanje', done: false };
  return { text: 'Vozilo nije preuzeto', done: false };
}

function DayList({ title, empty, rows, kind }) {
  return (
    <section className="admin-panel">
      <h2 className="admin-panel__title">
        {title} <span className="admin-count">{rows.length}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="admin-muted">{empty}</p>
      ) : (
        <ul className="admin-daylist">
          {rows.map((r) => {
            const time = formatTime(kind === 'pickup' ? r.pickup_time : r.return_time);
            const state = dayState(r, kind);
            return (
              <li key={r.id}>
                <Link to={`/rezervacije/${r.id}`} className="admin-daylist__item">
                  <span className="admin-daylist__time">{time || '—'}</span>
                  <span className="admin-daylist__main">
                    <strong>{r.customer_name}</strong>
                    <span className="admin-muted">
                      {vehicleById(r.car_id)?.name ?? r.car_name}
                      {r.registration && ` · ${r.registration}`} · {r.phone}
                    </span>
                  </span>
                  <span className={`admin-daystate${state.done ? ' admin-daystate--done' : ''}`}>{state.text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function Overview() {
  const { data, error, loading, reload } = useAdminData(() => adminApi.overview(), []);

  // Tabla često ostane otvorena u tabu danima. Podaci se ponovo učitavaju kad
  // se vratiš na tab i kad u Beogradu počne novi dan (provera svakog minuta).
  useEffect(() => {
    let day = todayBelgrade();
    const onVisible = () => document.visibilityState === 'visible' && reload();
    const timer = setInterval(() => {
      const now = todayBelgrade();
      if (now !== day) {
        day = now;
        reload();
      }
    }, 60_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload]);

  if (!data && loading) return <LoadingState />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;

  const counts = data.status_counts ?? {};
  // Vozni park je spisak vozila sa sajta; izdato = vozilo sa aktivnom rezervacijom.
  const total = FLEET_ORDER.length;
  const rented = data.rented_cars
    ? data.rented_cars.filter((id) => FLEET_ORDER.some((car) => car.id === id)).length
    : data.on_rent;
  const late = data.late_returns ?? [];

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1>Kontrolna tabla</h1>
          <p className="admin-muted">Danas je {formatDate(data.today)}</p>
        </div>
        <Link to="/rezervacije/nova" className="admin-btn admin-btn--accent">
          + Nova rezervacija
        </Link>
      </div>

      <div className="admin-stats admin-stats--3">
        <Stat value={total} label="Ukupno vozila" to="/vozila" />
        <Stat value={rented} label="Izdata vozila" to="/rezervacije?status=picked_up" />
        <Stat value={Math.max(total - rented, 0)} label="Slobodna vozila" to="/vozila" />
        <Stat value={data.confirmed ?? counts.confirmed ?? 0} label="Potvrđene rezervacije" to="/rezervacije?status=confirmed" />
        <Stat value={data.pickups_today.length} label="Preuzimanja danas" />
        <Stat value={data.returns_today.length} label="Vraćanja danas" />
      </div>

      {late.length > 0 && (
        <div className="admin-alert admin-late" role="alert">
          <p>
            <strong>Kasni sa vraćanjem: {late.length}</strong>
          </p>
          <ul>
            {late.map((r) => (
              <li key={r.id}>
                <Link to={`/rezervacije/${r.id}`}>{r.customer_name}</Link>
                {' · '}
                {vehicleById(r.car_id)?.name ?? r.car_name}
                {r.registration && ` (${r.registration})`} · trebalo je da vrati {formatDate(r.return_date)}
                {r.return_time && ` u ${formatTime(r.return_time)}`} ·{' '}
                <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`}>{r.phone}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="admin-section-title">Današnje aktivnosti</h2>
      <div className="admin-grid-2">
        <DayList title="Preuzimanja danas" empty="Danas nema preuzimanja." rows={data.pickups_today} kind="pickup" />
        <DayList title="Vraćanja danas" empty="Danas nema vraćanja." rows={data.returns_today} kind="return" />
      </div>

      <section className="admin-panel">
        <h2 className="admin-panel__title">Sve rezervacije po statusu</h2>
        <div className="admin-status-counts">
          {STATUS_ORDER.map((status) => (
            <Link key={status} to={`/rezervacije?status=${status}`} className="admin-status-count">
              <span className="admin-status-count__value">{counts[status] ?? 0}</span>
              <StatusBadge status={status} />
            </Link>
          ))}
        </div>
        <p className="admin-muted admin-hint">Klikni na status da vidiš te rezervacije. {STATUSES.confirmed} = čeka preuzimanje.</p>
      </section>
    </div>
  );
}
