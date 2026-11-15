import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusBadge from '../components/StatusBadge';
import { ErrorState, LoadingState } from '../components/States';
import { useToast } from '../components/Toast';
import { adminApi, useAdminData } from '../lib/adminApi';
import Payments from '../components/Payments';
import { ageFrom, formatDate, formatDateTime, formatDays, formatMoney, formatTime, shortId, todayBelgrade } from '../lib/format';
import {
  actorLabel,
  EVENT_LABELS,
  extraName,
  FIELD_LABELS,
  LANGUAGES,
  MONEY_FIELDS,
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  PRICE_SOURCES,
  SOURCES,
  STATUSES,
  TRANSITIONS,
} from '../lib/labels';

// Načini plaćanja pri preuzimanju vozila.
const PICKUP_METHODS = ['cash', 'card'];

// Sadržaj prozora "Vozilo preuzeto": kupac pri preuzimanju plaća ceo iznos.
function pickupDialog(r, method, setMethod, editHref) {
  if (r.total_price === null) {
    return {
      text: 'Kupac pri preuzimanju plaća ceo iznos rezervacije, a ova rezervacija nema cenu. Prvo upiši cenu, pa označi preuzimanje.',
      confirmLabel: 'Preuzeto i plaćeno',
      confirmDisabled: true,
      body: (
        <Link to={editHref} className="admin-link">
          Upiši cenu (Izmeni)
        </Link>
      ),
    };
  }
  const total = Number(r.total_price);
  const due = Math.max(total - Number(r.net_paid), 0);
  if (due === 0) {
    return {
      text: `Rezervacija je već plaćena u celosti (${formatMoney(total)}). Potvrdom se samo označava da je kupac preuzeo vozilo.`,
      confirmLabel: 'Vozilo preuzeto',
      confirmDisabled: false,
      body: null,
    };
  }
  return {
    text: 'Kupac pri preuzimanju plaća ceo iznos rezervacije. Potvrdom se vozilo označava kao preuzeto (današnji datum i vreme), a iznos se upisuje kao prihod.',
    confirmLabel: 'Preuzeto i plaćeno',
    confirmDisabled: !method,
    body: (
      <div className="admin-pickup">
        <div className="admin-pickup__amount">
          <span className="admin-muted">Naplaćuje se</span>
          <strong>{formatMoney(due)}</strong>
          {due < total && (
            <span className="admin-muted">
              ostatak do {formatMoney(total)} — ranije uplaćeno {formatMoney(Number(r.net_paid))}
            </span>
          )}
        </div>
        <div className="admin-pickup__methods" role="group" aria-label="Način plaćanja">
          <span className="admin-muted">Način plaćanja</span>
          <div>
            {PICKUP_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                className={`admin-chip${method === m ? ' admin-chip--on' : ''}`}
                aria-pressed={method === m}
                onClick={() => setMethod(m)}
              >
                {PAYMENT_METHODS[m]}
              </button>
            ))}
          </div>
        </div>
      </div>
    ),
  };
}

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
  if (MONEY_FIELDS.includes(field)) return formatMoney(value);
  switch (field) {
    case 'price_source':
      return PRICE_SOURCES[value] ?? value;
    case 'discount_percent':
      return `${Number(value)}%`;
    case 'status':
      return STATUSES[value] ?? value;
    case 'pickup_date':
    case 'return_date':
    case 'date_of_birth':
    case 'paid_at':
      return formatDate(value);
    case 'pickup_time':
    case 'return_time':
      return formatTime(value);
    case 'picked_up_at':
    case 'returned_at':
      return value ? formatDateTime(value) : '—';
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
    return (
      <span className="admin-muted">
        {PAYMENT_KINDS[changes.kind] ?? changes.kind}: {formatMoney(changes.amount)}
        {changes.reason && ` — ${changes.reason}`}
      </span>
    );
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
  const [method, setMethod] = useState(null); // gotovina ili kartica pri preuzimanju

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
      if (pending.to === 'picked_up') {
        const res = await adminApi.pickup(r.id, method);
        toast.success(
          Number(res.paid) > 0
            ? `Vozilo preuzeto · naplaćeno ${formatMoney(res.paid)} (${PAYMENT_METHODS[res.method].toLowerCase()}).`
            : 'Vozilo preuzeto.',
        );
      } else if (pending.action === 'return') {
        const res = await adminApi.returnCar(r.id);
        toast.success(
          res.shortened
            ? `Vozilo vraćeno · rezervacija je završena, termin je skraćen do ${formatDate(res.return_date)} (ostali dani su slobodni).`
            : 'Vozilo vraćeno · rezervacija je završena.',
        );
      } else if (pending.action === 'undo_pickup') {
        const res = await adminApi.undoPickup(r.id);
        toast.success(
          Number(res.voided) > 0
            ? `Preuzimanje je poništeno · naplata od ${formatMoney(res.voided)} je poništena.`
            : 'Preuzimanje je poništeno.',
        );
      } else {
        await adminApi.setStatus(r.id, pending.to);
        toast.success(`Status je promenjen: ${STATUSES[pending.to]}.`);
      }
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
              onClick={() => {
                setMethod(null);
                setPending(t);
              }}
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
              {formatDays(r.days)}
            </Row>
            {r.picked_up_at && <Row label="Preuzeto">{formatDateTime(r.picked_up_at)}</Row>}
            {r.returned_at && <Row label="Vraćeno">{formatDateTime(r.returned_at)}</Row>}
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
                <span className="admin-warning">Nije poznat — dodaj ga preko „Izmeni“</span>
              ) : (
                <>
                  <strong className="admin-amount">{formatMoney(r.total_price)}</strong>
                  {r.daily_rate !== null && (
                    <div className="admin-muted">
                      {formatDays(r.rental_days)} × {formatMoney(r.daily_rate)}
                      {/* Popust važi samo za cenu iz cenovnika, ne za ručno unetu. */}
                      {Number(r.discount_percent) > 0 && r.price_source !== 'admin' && ` (popust ${Number(r.discount_percent)}%)`} ={' '}
                      {formatMoney(r.rental_total)}
                      {r.price_source && ` · ${PRICE_SOURCES[r.price_source]}`}
                    </div>
                  )}
                </>
              )}
            </Row>
            <Row label="Dodaci">
              {r.extras?.length || Number(r.extras_total) > 0 ? (
                <>
                  {r.extras?.length ? r.extras.map(extraName).join(', ') : 'Dodaci'}
                  {r.extras_total !== null && <strong> · {formatMoney(r.extras_total)}</strong>}
                </>
              ) : (
                '—'
              )}
            </Row>
          </dl>
        </section>

        <section className="admin-panel">
          <h2 className="admin-panel__title">Napomena</h2>
          <p className="admin-note">{r.note || <span className="admin-muted">Nema napomene.</span>}</p>
        </section>
      </div>

      <Payments reservation={r} payments={data.payments} />

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

      {pending && pending.to !== 'picked_up' && (
        <ConfirmDialog
          title={pending.label}
          text={
            pending.action === 'return' && todayBelgrade() < r.return_date
              ? `${pending.confirm} Vraća se pre planiranog dana (${formatDate(r.return_date)}): preostali dani se oslobađaju za druge rezervacije, a cena i naplata ostaju iste.`
              : pending.confirm
          }
          confirmLabel={pending.label}
          danger={pending.danger}
          busy={busy}
          onConfirm={changeStatus}
          onCancel={() => setPending(null)}
        />
      )}
      {pending?.to === 'picked_up' &&
        (() => {
          const d = pickupDialog(r, method, setMethod, `/rezervacije/${r.id}/izmena`);
          return (
            <ConfirmDialog
              title={pending.label}
              text={d.text}
              confirmLabel={d.confirmLabel}
              confirmDisabled={d.confirmDisabled}
              busy={busy}
              onConfirm={changeStatus}
              onCancel={() => setPending(null)}
            >
              {d.body}
            </ConfirmDialog>
          );
        })()}
    </div>
  );
}
