import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { adminApi, useAdminData } from '../lib/adminApi';
import { formatDate, formatMoney } from '../lib/format';
import { PAYMENT_KINDS, PAYMENT_METHODS, vehicleById } from '../lib/labels';
import StatusBadge from './StatusBadge';

const VISIBLE_ROWS = 10;

// Prihod čine samo uplate za rezervacije čije je vozilo preuzeto (isto kao admin_income).
const COUNTED = ['picked_up', 'completed'];
const NOT_COUNTED = {
  confirmed: 'Vozilo nije preuzeto — ne ulazi u prihod',
  cancelled: 'Otkazana — ne ulazi u prihod',
  no_show: 'Nije se pojavio — ne ulazi u prihod',
};

// Zašto se ova uplata ne računa u prihod, ili šta treba proveriti (prazno = sve u redu).
function notesFor(r) {
  const notes = [];
  if (!COUNTED.includes(r.status)) notes.push({ text: NOT_COUNTED[r.status] ?? 'Ne ulazi u prihod' });
  const balance = r.balance === null ? null : Number(r.balance);
  if (balance !== null && balance < 0) notes.push({ text: `Preplaćeno ${formatMoney(-balance)}`, warning: true });
  return notes;
}

// Spisak uplata i povraćaja u periodu u analitici: od čega je sabran prihod.
export default function PeriodPayments({ from, to, carId }) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const { data, error, loading, reload } = useAdminData(
    () => adminApi.listPayments({ from, to, carId }),
    [from, to, carId],
  );

  if (!data && loading) return <p className="admin-muted">Učitavam uplate…</p>;
  if (!data && error) {
    return (
      <div className="admin-period-payments__error">
        <p className="admin-error">{error.message}</p>
        <button type="button" className="admin-btn admin-btn--small" onClick={reload}>
          Pokušaj ponovo
        </button>
      </div>
    );
  }

  const rows = data.rows;
  if (rows.length === 0) return <p className="admin-muted">U ovom periodu nema zabeleženih uplata.</p>;
  const visible = showAll ? rows : rows.slice(0, VISIBLE_ROWS);

  return (
    <>
      <p className="admin-muted admin-hint">
        Stavke iz kojih je sabran prihod u izabranom periodu. Napomena pored stavke kaže ako se ne računa. Klik na red
        otvara rezervaciju.
      </p>
      <div className={`admin-table-wrap${loading ? ' admin-table-wrap--loading' : ''}`}>
        <table className="admin-table admin-table--responsive">
          <thead>
            <tr>
              <th>Datum uplate</th>
              <th>Kupac</th>
              <th>Termin najma</th>
              <th>Vrsta</th>
              <th>Iznos</th>
              <th>Rezervacija</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => {
              const r = p.reservation;
              const notes = notesFor(r);
              return (
                <tr key={p.id} className="admin-row" onClick={() => navigate(`/rezervacije/${r.id}`)}>
                  <td data-label="Datum uplate">
                    <div className="admin-nowrap">{formatDate(p.paid_at)}</div>
                  </td>
                  <td data-label="Kupac">
                    <div>
                      <Link to={`/rezervacije/${r.id}`} className="admin-link" onClick={(e) => e.stopPropagation()}>
                        {r.customer_name}
                      </Link>
                      <div className="admin-muted">{vehicleById(r.car_id)?.name ?? r.car_name}</div>
                    </div>
                  </td>
                  <td data-label="Termin najma">
                    <div className="admin-nowrap">
                      {formatDate(r.pickup_date)} → {formatDate(r.return_date)}
                    </div>
                  </td>
                  <td data-label="Vrsta">
                    <div>
                      {PAYMENT_KINDS[p.kind] ?? p.kind}
                      <div className="admin-muted">{PAYMENT_METHODS[p.method] ?? p.method}</div>
                    </div>
                  </td>
                  <td data-label="Iznos">
                    <div className="admin-nowrap">
                      <strong>{p.kind === 'refund' ? `−${formatMoney(p.amount)}` : formatMoney(p.amount)}</strong>
                    </div>
                  </td>
                  <td data-label="Rezervacija">
                    <div className="admin-period-payments__status">
                      <StatusBadge status={r.status} />
                      {notes.map((n) => (
                        <span key={n.text} className={n.warning ? 'admin-warning' : 'admin-muted'}>
                          {n.text}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > VISIBLE_ROWS && (
        <button type="button" className="admin-link admin-period-payments__more" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Prikaži manje' : `Prikaži sve (${rows.length})`}
        </button>
      )}
    </>
  );
}
