import { useState } from 'react';
import { ErrorState, LoadingState } from '../components/States';
import { useToast } from '../components/Toast';
import { adminApi, useAdminData } from '../lib/adminApi';
import { FLEET_ORDER } from '../lib/labels';

function VehicleRow({ car, saved, onSaved }) {
  const toast = useToast();
  const [registration, setRegistration] = useState(saved?.registration ?? '');
  const [notes, setNotes] = useState(saved?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const dirty = registration.trim().toUpperCase() !== (saved?.registration ?? '') || notes.trim() !== (saved?.notes ?? '');

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.saveVehicle(car.id, registration.trim(), notes.trim());
      toast.success(`Sačuvano: ${car.name}.`);
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="admin-vehicle" onSubmit={save}>
      <div className="admin-vehicle__name">
        <strong>{car.name}</strong>
        <span className="admin-muted">
          {car.category} · {car.pricePerDay}€/dan
        </span>
      </div>
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
      <button type="submit" className="admin-btn admin-btn--accent" disabled={!dirty || saving}>
        {saving ? 'Čuvam…' : 'Sačuvaj'}
      </button>
    </form>
  );
}

export default function Vehicles() {
  const { data, error, loading, reload } = useAdminData(() => adminApi.listVehicles(), []);

  if (!data && loading) return <LoadingState />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;

  const registry = Object.fromEntries(data.map((v) => [v.car_id, v]));

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1>Vozila</h1>
          <p className="admin-muted">
            Registarske oznake i interne beleške vide se samo u admin panelu (lista, detalj, kalendar, pretraga). Nazivi,
            cene i slike vozila su deo sajta i menjaju se u njegovom kodu.
          </p>
        </div>
      </div>

      <div className="admin-panel admin-vehicles">
        {FLEET_ORDER.map((car) => (
          <VehicleRow
            // key sa sačuvanom vrednošću: posle čuvanja red kreće od nove vrednosti
            key={`${car.id}-${registry[car.id]?.registration ?? ''}-${registry[car.id]?.notes ?? ''}`}
            car={car}
            saved={registry[car.id]}
            onSaved={reload}
          />
        ))}
      </div>
    </div>
  );
}
