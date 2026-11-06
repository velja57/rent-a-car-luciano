import { STATUSES } from '../lib/labels';

// Status vozila: "Izdato" dok je kod kupca (rezervacija sa preuzetim vozilom), inače "Dostupno".
export function VehicleStatus({ rented }) {
  return rented ? (
    <span className="admin-status admin-status--rented">Izdato</span>
  ) : (
    <span className="admin-status admin-status--available">Dostupno</span>
  );
}

export default function StatusBadge({ status }) {
  return <span className={`admin-status admin-status--${status}`}>{STATUSES[status] ?? status}</span>;
}
