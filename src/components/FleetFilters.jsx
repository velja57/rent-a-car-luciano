import { VEHICLE_TYPES } from '../data/fleet';
import { useI18n } from '../i18n';
import { FUELS, SORTS, TRANSMISSIONS } from '../lib/useFleetFilters';

// Tip vozila, menjač, gorivo i sortiranje. filters: rezultat useFleetFilters.
export default function FleetFilters({ filters }) {
  const { t } = useI18n();
  const f = t.fleetPage;
  const { type, transmission, fuel, sort, setParam } = filters;

  return (
    <div className="fleet-filters" role="group" aria-label={f.filtersLabel}>
      <div className="fleet-filters__chips">
        <button
          type="button"
          className={`fleet-chip${type ? '' : ' fleet-chip--active'}`}
          aria-pressed={!type}
          onClick={() => setParam('tip', '')}
        >
          {f.allTypes}
        </button>
        {VEHICLE_TYPES.map((id) => (
          <button
            type="button"
            key={id}
            className={`fleet-chip${type === id ? ' fleet-chip--active' : ''}`}
            aria-pressed={type === id}
            onClick={() => setParam('tip', type === id ? '' : id)}
          >
            {t.types[id]}
          </button>
        ))}
      </div>

      <div className="fleet-filters__selects">
        <label className="fleet-select">
          <span>{f.transmission}</span>
          <select value={transmission} onChange={(e) => setParam('menjac', e.target.value)}>
            <option value="">{f.allTransmissions}</option>
            {TRANSMISSIONS.map((id) => (
              <option key={id} value={id}>
                {f.transmissions[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="fleet-select">
          <span>{f.fuel}</span>
          <select value={fuel} onChange={(e) => setParam('gorivo', e.target.value)}>
            <option value="">{f.allFuels}</option>
            {FUELS.map((id) => (
              <option key={id} value={id}>
                {f.fuels[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="fleet-select">
          <span>{f.sort}</span>
          <select value={sort.id} onChange={(e) => setParam('sort', e.target.value === SORTS[0].id ? '' : e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {f.sorts[s.id]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
