import { useState } from 'react';
import { ErrorState, LoadingState } from '../components/States';
import { useToast } from '../components/Toast';
import { loadPriceList } from '../../lib/priceList';
import { adminApi, useAdminData } from '../lib/adminApi';
import { extraName, FLEET_ORDER } from '../lib/labels';

const isWholeNumber = (value, min, max) => /^\d+$/.test(String(value).trim()) && Number(value) >= min && Number(value) <= max;

function VehicleRow({ car, saved, price, onSaved }) {
  const toast = useToast();
  const [registration, setRegistration] = useState(saved?.registration ?? '');
  const [notes, setNotes] = useState(saved?.notes ?? '');
  const [dayPrice, setDayPrice] = useState(price === undefined ? '' : String(price));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const registryDirty = registration.trim().toUpperCase() !== (saved?.registration ?? '') || notes.trim() !== (saved?.notes ?? '');
  const priceDirty = dayPrice.trim() !== (price === undefined ? '' : String(price));

  const save = async (e) => {
    e.preventDefault();
    if (priceDirty && !isWholeNumber(dayPrice, 1, 10000)) {
      setError('Cena po danu je ceo broj evra (1–10.000).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (registryDirty) await adminApi.saveVehicle(car.id, registration.trim(), notes.trim());
      if (priceDirty) await adminApi.setCarPrice(car.id, Number(dayPrice));
      toast.success(`Sačuvano: ${car.name}.`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="admin-vehicle" onSubmit={save}>
      <div className="admin-vehicle__name">
        <strong>{car.name}</strong>
        <span className="admin-muted">{car.category}</span>
        {price === undefined && <span className="admin-warning">Nije u cenovniku</span>}
      </div>
      <label className="admin-field">
        <span>Cena po danu (€)</span>
        <input type="number" inputMode="numeric" min="1" step="1" value={dayPrice} onChange={(e) => setDayPrice(e.target.value)} />
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
      <button type="submit" className="admin-btn admin-btn--accent" disabled={(!registryDirty && !priceDirty) || saving}>
        {saving ? 'Čuvam…' : 'Sačuvaj'}
      </button>
      {error && <p className="admin-error admin-vehicle__error">{error}</p>}
    </form>
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

  // Posle izmene: osveži stranicu i cene u ostatku admin panela (forme, predlozi).
  const refresh = () => {
    reload();
    loadPriceList({ force: true });
  };

  if (!data && loading) return <LoadingState />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;

  const registry = Object.fromEntries(data.registry.map((v) => [v.car_id, v]));
  const prices = data.prices.cars ?? {};
  const tiers = data.prices.discounts ?? [];
  const extras = data.prices.extras ?? [];

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1>Vozila i cenovnik</h1>
          <p className="admin-muted">
            Promena cene važi odmah na sajtu i za nove rezervacije. Postojeće rezervacije zadržavaju cenu iz trenutka
            rezervacije. Registarske oznake i beleške vide se samo u admin panelu.
          </p>
        </div>
      </div>

      <section className="admin-panel admin-vehicles">
        <h2 className="admin-panel__title">Vozila</h2>
        {FLEET_ORDER.map((car) => (
          <VehicleRow
            // key sa sačuvanim vrednostima: posle čuvanja red kreće od novih vrednosti
            key={`${car.id}-${registry[car.id]?.registration ?? ''}-${registry[car.id]?.notes ?? ''}-${prices[car.id] ?? ''}`}
            car={car}
            saved={registry[car.id]}
            price={prices[car.id]}
            onSaved={refresh}
          />
        ))}
      </section>

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
          <p className="admin-muted admin-hint">Cena dodatka po danu najma ili jednom po rezervaciji.</p>
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
