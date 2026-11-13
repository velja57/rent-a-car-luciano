import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { VehicleStatus } from '../components/StatusBadge';
import { ErrorState, LoadingState } from '../components/States';
import { useToast } from '../components/Toast';
import { loadPriceList } from '../../lib/priceList';
import { adminApi, useAdminData } from '../lib/adminApi';
import { formatDateWithTime, formatMoney } from '../lib/format';
import { EXTRAS } from '../../data/rental';
import { extraName, FLEET_ORDER } from '../lib/labels';

const isWholeNumber = (value, min, max) => /^\d+$/.test(String(value).trim()) && Number(value) >= min && Number(value) <= max;

// Spisak vozila: fotografija, model, godište, registracija, cena i status.
// Klik na vozilo otvara njegovu stranicu (istorija, prihod, izmena podataka).
function FleetTable({ registry, prices, fullCover, fleet }) {
  const navigate = useNavigate();
  return (
    <div className="admin-table-wrap">
      <table className="admin-table admin-table--responsive admin-table--fleet">
        <thead>
          <tr>
            <th>Vozilo</th>
            <th>Godište</th>
            <th>Registracija</th>
            <th>Cena po danu</th>
            <th>Puno kasko</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {FLEET_ORDER.map((car) => {
            const rented = fleet?.[car.id]?.rented ?? null;
            const photo = car.images?.[0];
            return (
              <tr key={car.id} className="admin-row" onClick={() => navigate(`/vozila/${car.id}`)}>
                <td data-label="Vozilo">
                  <div className="admin-fleet-car">
                    {photo && (
                      <img
                        className="admin-fleet-car__photo"
                        src={photo.thumb}
                        alt=""
                        loading="lazy"
                        style={photo.focus ? { objectPosition: photo.focus } : undefined}
                      />
                    )}
                    <span className="admin-fleet-car__name">
                      <Link to={`/vozila/${car.id}`} onClick={(e) => e.stopPropagation()}>
                        {car.name}
                      </Link>
                      <span className="admin-muted">{car.category}</span>
                    </span>
                  </div>
                </td>
                <td data-label="Godište">
                  <div>{car.year}</div>
                </td>
                <td data-label="Registracija">
                  <div className="admin-nowrap">{registry[car.id]?.registration || <span className="admin-muted">—</span>}</div>
                </td>
                <td data-label="Cena po danu">
                  <div className="admin-nowrap">
                    {prices[car.id] === undefined ? <span className="admin-warning">Nije u cenovniku</span> : formatMoney(prices[car.id])}
                  </div>
                </td>
                <td data-label="Puno kasko">
                  <div className="admin-nowrap">
                    {fullCover[car.id] === undefined ? <span className="admin-muted">—</span> : `${formatMoney(fullCover[car.id])} / dan`}
                  </div>
                </td>
                <td data-label="Status">
                  <div>
                    {fleet ? <VehicleStatus rented={rented} /> : <span className="admin-muted">…</span>}
                    {rented && (
                      <div className="admin-muted admin-nowrap">do {formatDateWithTime(rented.return_date, rented.return_time)}</div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Jedna stavka cenovnika (popust ili dodatak): naziv, polje i "Sačuvaj".
function PriceRow({ label, hint, suffix, value, min, max, onSave }) {
  const toast = useToast();
  const [input, setInput] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const dirty = input.trim() !== String(value);

  const save = async (e) => {
    e.preventDefault();
    if (!isWholeNumber(input, min, max)) {
      setError(`Ceo broj od ${min} do ${max}.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(Number(input));
      toast.success(`Sačuvano: ${label}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="admin-price-row" onSubmit={save}>
      <div className="admin-vehicle__name">
        <strong>{label}</strong>
        {hint && <span className="admin-muted">{hint}</span>}
      </div>
      <label className="admin-field admin-price-row__field">
        <span className="admin-visually-hidden">{label}</span>
        <input type="number" inputMode="numeric" min={min} max={max} step="1" value={input} onChange={(e) => setInput(e.target.value)} />
        <em className="admin-price-row__suffix">{suffix}</em>
      </label>
      <button type="submit" className="admin-btn admin-btn--accent" disabled={!dirty || saving}>
        {saving ? 'Čuvam…' : 'Sačuvaj'}
      </button>
      {error && <p className="admin-error admin-vehicle__error">{error}</p>}
    </form>
  );
}

function discountLabel(tiers, index) {
  const next = tiers[index + 1];
  const from = tiers[index].min_days;
  return next ? `${from}–${next.min_days - 1} ${next.min_days - 1 === 1 ? 'dan' : 'dana'}` : `${from}+ dana`;
}

export default function Vehicles() {
  const { data, error, loading, reload } = useAdminData(
    () => Promise.all([adminApi.listVehicles(), adminApi.priceList()]).then(([registry, prices]) => ({ registry, prices })),
    [],
  );
  const fleet = useAdminData(() => adminApi.fleet(), []);

  // Posle izmene: osveži stranicu i cene u ostatku admin panela (forme, predlozi).
  const refresh = () => {
    reload();
    loadPriceList({ force: true });
  };

  if (!data && loading) return <LoadingState />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;

  const registry = Object.fromEntries(data.registry.map((v) => [v.car_id, v]));
  const prices = data.prices.cars ?? {};
  const fullCover = data.prices.full_cover ?? {};
  const tiers = data.prices.discounts ?? [];
  // Samo dodaci koje sajt nudi. Puno kasko ima cenu po vozilu (stranica vozila), pa ga ovde nema.
  const extras = (data.prices.extras ?? []).filter((extra) => extra.id !== 'full-cover' && EXTRAS.some((e) => e.id === extra.id));
  const cars = fleet.data?.cars;
  const rentedCount = cars ? FLEET_ORDER.filter((car) => cars[car.id]?.rented).length : null;

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1>Vozni park</h1>
          <p className="admin-muted">
            {FLEET_ORDER.length} vozila
            {rentedCount !== null && ` · izdato ${rentedCount} · dostupno ${FLEET_ORDER.length - rentedCount}`}. Klikni
            na vozilo za istoriju rezervacija, prihod i izmenu cene, registracije ili beleške.
          </p>
        </div>
      </div>

      {fleet.error && <ErrorState error={fleet.error} onRetry={fleet.reload} />}

      <FleetTable registry={registry} prices={prices} fullCover={fullCover} fleet={cars} />

      <h2 className="admin-section-title">Cenovnik</h2>
      <p className="admin-muted admin-hint">
        Promena važi odmah na sajtu i za nove rezervacije. Postojeće rezervacije zadržavaju cenu iz trenutka rezervacije.
      </p>
      <div className="admin-grid-2">
        <section className="admin-panel admin-vehicles">
          <h2 className="admin-panel__title">Popust za duži najam</h2>
          <p className="admin-muted admin-hint">Popust na cenu po danu, zavisno od broja dana najma.</p>
          {tiers.map((tier, i) => (
            <PriceRow
              key={`${tier.min_days}-${tier.discount_percent}`}
              label={discountLabel(tiers, i)}
              suffix="%"
              value={tier.discount_percent}
              min={0}
              max={90}
              onSave={async (percent) => {
                await adminApi.setDiscount(tier.min_days, percent);
                refresh();
              }}
            />
          ))}
        </section>

        <section className="admin-panel admin-vehicles">
          <h2 className="admin-panel__title">Dodatne usluge</h2>
          <p className="admin-muted admin-hint">
            Cena dodatka po danu najma ili jednom po rezervaciji. Puno kasko ima cenu za svako vozilo posebno — menja se
            na stranici vozila (klik na vozilo u tabeli iznad).
          </p>
          {extras.map((extra) => (
            <PriceRow
              key={`${extra.id}-${extra.price}`}
              label={extraName(extra.id)}
              hint={extra.per === 'day' ? 'po danu' : 'po rezervaciji'}
              suffix="€"
              value={extra.price}
              min={0}
              max={10000}
              onSave={async (price) => {
                await adminApi.setExtraPrice(extra.id, price);
                refresh();
              }}
            />
          ))}
        </section>
      </div>
    </div>
  );
}
