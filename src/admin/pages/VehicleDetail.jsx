import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import Pagination from '../components/Pagination';
import StatusBadge, { VehicleStatus } from '../components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { useToast } from '../components/Toast';
import { loadPriceList } from '../../lib/priceList';
import { adminApi, useAdminData } from '../lib/adminApi';
import { formatDate, formatDateTime, formatDateWithTime, formatMoney, formatTime, shortId } from '../lib/format';
import { vehicleById } from '../lib/labels';

const PAGE_SIZE = 25;

const isWholeNumber = (value, min, max) => /^\d+$/.test(String(value).trim()) && Number(value) >= min && Number(value) <= max;

function Row({ label, children }) {
  return (
    <div className="admin-dl__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="admin-stat">
      <span className="admin-stat__value">{value}</span>
      <span className="admin-stat__label">{label}</span>
    </div>
  );
}

// Cena po danu i puno kasko (cenovnik u bazi), registarska oznaka i interna beleška.
function EditForm({ car, saved, price, fullCover, onSaved }) {
  const toast = useToast();
  const [registration, setRegistration] = useState(saved?.registration ?? '');
  const [notes, setNotes] = useState(saved?.notes ?? '');
  const [dayPrice, setDayPrice] = useState(price === undefined ? '' : String(price));
  const [coverPrice, setCoverPrice] = useState(fullCover === undefined ? '' : String(fullCover));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const registryDirty = registration.trim().toUpperCase() !== (saved?.registration ?? '') || notes.trim() !== (saved?.notes ?? '');
  const priceDirty = dayPrice.trim() !== (price === undefined ? '' : String(price));
  const coverDirty = coverPrice.trim() !== (fullCover === undefined ? '' : String(fullCover));

  const save = async (e) => {
    e.preventDefault();
    if (priceDirty && !isWholeNumber(dayPrice, 1, 10000)) {
      setError('Cena po danu je ceo broj evra (1–10.000).');
      return;
    }
    if (coverDirty && !isWholeNumber(coverPrice, 0, 10000)) {
      setError('Puno kasko je ceo broj evra po danu (0–10.000).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (registryDirty) await adminApi.saveVehicle(car.id, registration.trim(), notes.trim());
      if (priceDirty) await adminApi.setCarPrice(car.id, Number(dayPrice));
      if (coverDirty) await adminApi.setCarFullCover(car.id, Number(coverPrice));
      toast.success(`Sačuvano: ${car.name}.`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="admin-vehicle-edit" onSubmit={save}>
      <label className="admin-field">
        <span>Cena po danu (€)</span>
        <input type="number" inputMode="numeric" min="1" step="1" value={dayPrice} onChange={(e) => setDayPrice(e.target.value)} />
      </label>
      <label className="admin-field">
        <span>Puno kasko (€/dan)</span>
        <input type="number" inputMode="numeric" min="0" step="1" value={coverPrice} onChange={(e) => setCoverPrice(e.target.value)} />
      </label>
      <label className="admin-field">
        <span>Registarska oznaka</span>
        <input
          type="text"
          placeholder="npr. BG 123-AB"
          value={registration}
          onChange={(e) => setRegistration(e.target.value)}
          maxLength={20}
        />
      </label>
      <label className="admin-field">
        <span>Interna beleška</span>
        <input type="text" placeholder="npr. servis 15.11." value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error && <p className="admin-error">{error}</p>}
      <button type="submit" className="admin-btn admin-btn--accent" disabled={(!registryDirty && !priceDirty && !coverDirty) || saving}>
        {saving ? 'Čuvam…' : 'Sačuvaj'}
      </button>
      <p className="admin-muted admin-hint">
        Promena cene važi odmah na sajtu i za nove rezervacije. Postojeće rezervacije zadržavaju cenu iz trenutka
        rezervacije. Registarska oznaka i beleška vide se samo u admin panelu.
      </p>
    </form>
  );
}

function History({ carId }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('strana')) || 1);
  const { data, error, loading, reload } = useAdminData(
    () =>
      adminApi.listReservations({
        p_car_id: carId,
        p_sort: 'pickup_date',
        p_desc: true,
        p_limit: PAGE_SIZE,
        p_offset: (page - 1) * PAGE_SIZE,
      }),
    [carId, page],
  );
  const rows = data?.rows ?? [];

  return (
    <section className="admin-panel">
      <h2 className="admin-panel__title">
        Istorija rezervacija {data && <span className="admin-count">{data.total}</span>}
      </h2>
      {!data && loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.total === 0 && <EmptyState title="Ovo vozilo još nema rezervacija." />}
      {rows.length > 0 && (
        <>
          <div className={`admin-table-wrap${loading ? ' admin-table-wrap--loading' : ''}`}>
            <table className="admin-table admin-table--responsive">
              <thead>
                <tr>
                  <th>Rezervacija</th>
                  <th>Kupac</th>
                  <th>Termin</th>
                  <th>Iznos</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`admin-row admin-row--${r.status}`} onClick={() => navigate(`/rezervacije/${r.id}`)}>
                    <td data-label="Rezervacija">
                      <div>
                        <Link to={`/rezervacije/${r.id}`} className="admin-id" onClick={(e) => e.stopPropagation()}>
                          #{shortId(r.id)}
                        </Link>
                        <div className="admin-muted admin-nowrap">{formatDateTime(r.created_at)}</div>
                      </div>
                    </td>
                    <td data-label="Kupac">
                      <div>
                        <strong>{r.customer_name}</strong>
                        <div className="admin-muted admin-nowrap">{r.phone}</div>
                      </div>
                    </td>
                    <td data-label="Termin">
                      <div>
                        <span className="admin-nowrap">
                          {formatDate(r.pickup_date)}
                          {r.pickup_time && ` ${formatTime(r.pickup_time)}`}
                        </span>{' '}
                        →{' '}
                        <span className="admin-nowrap">
                          {formatDate(r.return_date)}
                          {r.return_time && ` ${formatTime(r.return_time)}`}
                        </span>
                        <div className="admin-muted">
                          {r.days} {r.days === 1 ? 'dan' : 'dana'}
                        </div>
                      </div>
                    </td>
                    <td data-label="Iznos">
                      <div className="admin-nowrap">{formatMoney(r.total_price)}</div>
                    </td>
                    <td data-label="Status">
                      <div>
                        <StatusBadge status={r.status} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            onChange={(p) => setParams(p > 1 ? { strana: String(p) } : {}, { replace: true })}
          />
        </>
      )}
    </section>
  );
}

// Stranica jednog vozila: podaci i izmena, status (Izdato / Dostupno), prihod i istorija rezervacija.
export default function VehicleDetail() {
  const { carId } = useParams();
  const car = vehicleById(carId);
  const info = useAdminData(
    () => Promise.all([adminApi.listVehicles(), adminApi.priceList()]).then(([registry, prices]) => ({ registry, prices })),
    [],
  );
  const fleet = useAdminData(() => adminApi.fleet(), []);

  const back = (
    <Link to="/vozila" className="admin-link admin-back">
      ← Vozni park
    </Link>
  );

  if (!car) {
    return (
      <div className="admin-page">
        {back}
        <EmptyState title="Vozilo nije pronađeno." text="Ovo vozilo nije u ponudi na sajtu." />
      </div>
    );
  }
  if (!info.data && info.loading) return <LoadingState />;
  if (!info.data && info.error) {
    return (
      <div className="admin-page">
        {back}
        <ErrorState error={info.error} onRetry={info.reload} />
      </div>
    );
  }

  const saved = info.data.registry.find((v) => v.car_id === car.id);
  const price = info.data.prices.cars?.[car.id];
  const fullCover = info.data.prices.full_cover?.[car.id];
  const stats = fleet.data?.cars?.[car.id];
  const rented = stats?.rented ?? null;
  const photo = car.images?.[0];

  // Posle izmene: osveži stranicu i cene u ostatku admin panela (forme, predlozi).
  const refresh = () => {
    info.reload();
    loadPriceList({ force: true });
  };

  return (
    <div className="admin-page">
      {back}

      <div className="admin-page__header">
        <div>
          <h1 className="admin-title-row">
            {car.name} {fleet.data && <VehicleStatus rented={rented} />}
          </h1>
          <p className="admin-muted">
            {car.category} · {car.year}
            {saved?.registration && ` · ${saved.registration}`}
          </p>
        </div>
      </div>

      {fleet.error && <ErrorState error={fleet.error} onRetry={fleet.reload} />}

      {rented && (
        <div className="admin-rented" role="status">
          Vozilo je kod kupca{' '}
          <Link to={`/rezervacije/${rented.id}`}>
            <strong>{rented.customer_name}</strong>
          </Link>
          {rented.picked_up_at && ` · preuzeto ${formatDateTime(rented.picked_up_at)}`} · vraća{' '}
          {formatDateWithTime(rented.return_date, rented.return_time)}
        </div>
      )}

      {fleet.data && (
        <>
          <div className="admin-stats admin-stats--3 admin-stats--vehicle">
            <Stat value={formatMoney(stats?.revenue ?? 0)} label="Ukupan prihod" />
            <Stat value={stats?.rentals ?? 0} label="Realizovanih najmova" />
            <Stat value={stats?.rental_days ?? 0} label="Dana u najmu" />
          </div>
          <p className="admin-muted admin-hint admin-fleet-hint">
            Prihod je novac naplaćen pri preuzimanju vozila. Najam se računa kad je vozilo preuzeto; otkazane rezervacije
            i „nije se pojavio“ se ne računaju.
          </p>
        </>
      )}

      <div className="admin-grid-2">
        <section className="admin-panel">
          <h2 className="admin-panel__title">Podaci o vozilu</h2>
          {photo && (
            <img
              className="admin-vehicle-photo"
              src={photo.src}
              alt={car.name}
              style={photo.focus ? { objectPosition: photo.focus } : undefined}
            />
          )}
          <dl className="admin-dl">
            <Row label="Marka i model">{car.name}</Row>
            <Row label="Godište">{car.year}</Row>
            <Row label="Registracija">{saved?.registration || '—'}</Row>
            <Row label="Cena po danu">
              {price === undefined ? <span className="admin-warning">Nije u cenovniku</span> : formatMoney(price)}
            </Row>
            <Row label="Puno kasko">
              {fullCover === undefined ? <span className="admin-muted">—</span> : `${formatMoney(fullCover)} / dan`}
            </Row>
            {saved?.notes && <Row label="Beleška">{saved.notes}</Row>}
          </dl>
        </section>

        <section className="admin-panel">
          <h2 className="admin-panel__title">Izmena podataka</h2>
          <EditForm
            // key sa sačuvanim vrednostima: posle čuvanja forma kreće od novih vrednosti
            key={`${saved?.registration ?? ''}-${saved?.notes ?? ''}-${price ?? ''}-${fullCover ?? ''}`}
            car={car}
            saved={saved}
            price={price}
            fullCover={fullCover}
            onSaved={refresh}
          />
        </section>
      </div>

      <History carId={car.id} />
    </div>
  );
}
