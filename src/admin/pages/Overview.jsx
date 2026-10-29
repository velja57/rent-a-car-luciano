import { Link } from 'react-router';
import StatusBadge from '../components/StatusBadge';
import { ErrorState, LoadingState } from '../components/States';
import { adminApi, useAdminData } from '../lib/adminApi';
import { formatDate, formatTime } from '../lib/format';
import { STATUS_ORDER, STATUSES } from '../lib/labels';

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
            return (
              <li key={r.id}>
                <Link to={`/rezervacije/${r.id}`} className="admin-daylist__item">
                  <span className="admin-daylist__time">{time || '—'}</span>
                  <span className="admin-daylist__main">
                    <strong>{r.customer_name}</strong>
                    <span className="admin-muted">
                      {r.car_name}
                      {r.registration && ` · ${r.registration}`} · {r.phone}
                    </span>
                  </span>
                  <StatusBadge status={r.status} />
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

  if (!data && loading) return <LoadingState />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;

  const counts = data.status_counts ?? {};
  const stats = [
    { label: 'Preuzimanja danas', value: data.pickups_today.length },
    { label: 'Vraćanja danas', value: data.returns_today.length },
    { label: 'Vozila kod kupaca', value: data.on_rent },
    { label: 'Preuzimanja u narednih 7 dana', value: data.upcoming_7_days },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1>Pregled</h1>
          <p className="admin-muted">Danas je {formatDate(data.today)}</p>
        </div>
        <Link to="/rezervacije/nova" className="admin-btn admin-btn--accent">
          + Nova rezervacija
        </Link>
      </div>

      <div className="admin-stats">
        {stats.map((s) => (
          <div key={s.label} className="admin-stat">
            <span className="admin-stat__value">{s.value}</span>
            <span className="admin-stat__label">{s.label}</span>
          </div>
        ))}
      </div>

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
