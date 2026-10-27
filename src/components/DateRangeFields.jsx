import { todayISO } from '../lib/pricing';

export default function DateRangeFields({ pickup, ret, onChange }) {
  const today = todayISO();

  const changePickup = (e) => {
    const next = e.target.value;
    // Ako novi datum preuzimanja "preskoči" vraćanje, vraćanje se briše.
    onChange({ pickup: next, ret: ret && next && ret <= next ? '' : ret });
  };

  return (
    <div className="date-range">
      <label className="date-range__field">
        <span className="date-range__label">Preuzimanje</span>
        <input type="date" value={pickup} min={today} onChange={changePickup} />
      </label>
      <svg className="date-range__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <label className="date-range__field">
        <span className="date-range__label">Vraćanje</span>
        <input type="date" value={ret} min={pickup || today} onChange={(e) => onChange({ pickup, ret: e.target.value })} />
      </label>
    </div>
  );
}
