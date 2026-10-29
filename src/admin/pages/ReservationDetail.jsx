import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusBadge from '../components/StatusBadge';
import { ErrorState, LoadingState } from '../components/States';
import { useToast } from '../components/Toast';
import { adminApi, useAdminData } from '../lib/adminApi';
import { ageFrom, formatDate, formatDateTime, formatMoney, formatTime, shortId } from '../lib/format';
import {
  actorLabel,
  EVENT_LABELS,
  extraName,
  FIELD_LABELS,
  LANGUAGES,
  SOURCES,
  STATUSES,
  TRANSITIONS,
} from '../lib/labels';

function Row({ label, children }) {
  return (
    <div className="admin-dl__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

// Vrednost iz istorije promena u čitljivom obliku.
function formatValue(field, value) {
  if (value === null || value === undefined || value === '') return '—';
  switch (field) {
    case 'status':
      return STATUSES[value] ?? value;
    case 'pickup_date':
    case 'return_date':
    case 'date_of_birth':
      return formatDate(value);
    case 'pickup_time':
    case 'return_time':
      return formatTime(value);
    case 'total_price':
      return formatMoney(value);
    case 'extras':
      return Array.isArray(value) && value.length ? value.map(extraName).join(', ') : '—';
    case 'language':
      return LANGUAGES[value] ?? value;
    case 'source':
      return SOURCES[value] ?? value;
    default:
      return String(value);
  }
}

function EventDetails({ event }) {
  const changes = event.changes ?? {};
  if (event.action === 'created') {
    return <span className="admin-muted">{SOURCES[changes.source] ?? ''}</span>;
  }
  if (event.action === 'payment_added' || event.action === 'payment_voided') {
    return <span className="admin-muted">{formatMoney(changes.amount)}</span>;
  }
  return (
    <ul className="admin-changes">
      {Object.entries(changes).map(([field, { from, to }]) => (
        <li key={field}>
          <span className="admin-muted">{FIELD_LABELS[field] ?? field}:</span> {formatValue(field, from)} →{' '}
          <strong>{formatValue(field, to)}</strong>
        </li>
      ))}
    </ul>
  );
}

export default function ReservationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { data, error, loading, reload } = useAdminData(() => adminApi.getReservation(id), [id]);
  const [pending, setPending] = useState(null); // prelaz statusa koji čeka potvrdu
  const [busy, setBusy] = useState(false);

  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/rezervacije'));

  if (!data && loading) return <LoadingState />;
  if (!data && error) {
    return (
      <div className="admin-page">
        <button type="button" className="admin-link admin-back" onClick={goBack}>
          ← Nazad
        </button>
        <ErrorState error={error} onRetry={error.reason === 'not_found' ? undefined : reload} />
      </div>
    );
  }

  const r = data.reservation;
  const age = ageFrom(r.date_of_birth);

  const changeStatus = async () => {
    setBusy(true);
    try {
      await adminApi.setStatus(r.id, pending.to);
      toast.success(`Status je promenjen: ${STATUSES[pending.to]}.`);
      setPending(null);
      reload();
    } catch (err) {
      toast.error(err.message);
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page">
      <button type="button" className="admin-link admin-back" onClick={goBack}>
        ← Nazad
      </button>

      <div className="admin-page__header">
        <div>
          <h1 className="admin-title-row">
            Rezervacija <span className="admin-id">#{shortId(r.id)}</span> <StatusBadge status={r.status} />
          </h1>
          <p className="admin-muted">
            Kreirana {formatDateTime(r.created_at)} · {SOURCES[r.source] ?? r.source}
            {r.updated_at && ` · izmenjena ${formatDateTime(r.updated_at)}`}
          </p>
        </div>
        <div className="admin-actions">
          {(TRANSITIONS[r.status] ?? []).map((t) => (
            <button
              key={t.to}
              type="button"
              className={`admin-btn${t.danger ? ' admin-btn--danger' : ''}`}
              onClick={() => setPending(t)}
            >
              {t.label}
            </button>
          ))}
          <Link to={`/rezervacije/${r.id}/izmena`} className="admin-btn admin-btn--accent">
            Izmeni
          </Link>
        </div>
      </div>

      <div className="admin-grid-2">
        <section className="admin-panel">
          <h2 className="admin-panel__title">Vozilo i termin</h2>
          <dl className="admin-dl">
            <Row label="Vozilo">
              {r.car_name}
              {r.registration && <span className="admin-muted"> · {r.registration}</span>}
            </Row>
            <Row label="Preuzimanje">
              {formatDate(r.pickup_date)}
              {r.pickup_time && ` u ${formatTime(r.pickup_time)}`}
              <div className="admin-muted">{r.pickup_location}</div>
            </Row>
            <Row label="Vraćanje">
              {formatDate(r.return_date)}
              {r.return_time && ` u ${formatTime(r.return_time)}`}
              <div className="admin-muted">{r.return_location || 'Ista lokacija kao preuzimanje'}</div>
            </Row>
            <Row label="Trajanje">
              {r.days} {r.days === 1 ? 'dan' : 'dana'}
            </Row>
          </dl>
        </section>

        <section className="admin-panel">
          <h2 className="admin-panel__title">Kupac</h2>
          <dl className="admin-dl">
            <Row label="Ime i prezime">{r.customer_name}</Row>
            <Row label="Telefon">
              <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`}>{r.phone}</a>
            </Row>
            <Row label="Email">{r.email ? <a href={`mailto:${r.email}`}>{r.email}</a> : '—'}</Row>
            <Row label="Datum rođenja">
              {r.date_of_birth ? `${formatDate(r.date_of_birth)} (${age} god.)` : '—'}
            </Row>
            <Row label="Jezik">{LANGUAGES[r.language] ?? r.language}</Row>
          </dl>
        </section>

        <section className="admin-panel">
          <h2 className="admin-panel__title">Cena</h2>
          <dl className="admin-dl">
            <Row label="Iznos">
              {r.total_price === null ? (
                <span className="admin-warning">Nije unet — dodaj ga preko „Izmeni“</span>
              ) : (
                <strong>{formatMoney(r.total_price)}</strong>
              )}
            </Row>
            <Row label="Dodaci">{r.extras?.length ? r.extras.map(extraName).join(', ') : '—'}</Row>
            {r.price_summary && <Row label="Obračun sa sajta">{r.price_summary}</Row>}
          </dl>
        </section>

        <section className="admin-panel">
          <h2 className="admin-panel__title">Napomena</h2>
          <p className="admin-note">{r.note || <span className="admin-muted">Nema napomene.</span>}</p>
        </section>
      </div>

      <section className="admin-panel">
        <h2 className="admin-panel__title">Istorija promena</h2>
        {data.events.length === 0 ? (
          <p className="admin-muted">Nema zabeleženih promena.</p>
        ) : (
          <ol className="admin-timeline">
            {data.events.map((event) => (
              <li key={event.id}>
                <div className="admin-timeline__head">
                  <strong>{EVENT_LABELS[event.action] ?? event.action}</strong>
                  <span className="admin-muted">
                    {formatDateTime(event.created_at)} · {actorLabel(event.actor)}
                  </span>
                </div>
                <EventDetails event={event} />
              </li>
            ))}
          </ol>
        )}
        {!data.events.some((event) => event.action === 'created') && (
          <p className="admin-muted admin-hint">
            Rezervacija je napravljena pre uvođenja istorije promena, pa nema zapis o nastanku.
          </p>
        )}
      </section>

      {pending && (
        <ConfirmDialog
          title={pending.label}
          text={pending.confirm}
          confirmLabel={pending.label}
          danger={pending.danger}
          busy={busy}
          onConfirm={changeStatus}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
