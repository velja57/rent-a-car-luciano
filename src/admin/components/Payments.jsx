import { formatDate, formatDateTime, formatMoney } from '../lib/format';
import { actorLabel, PAYMENT_KINDS, PAYMENT_METHODS } from '../lib/labels';

// Naplata rezervacije. Kupac plaća ceo iznos pri preuzimanju vozila, pa se naplata
// upisuje samo klikom na "Vozilo preuzeto" (nema ručnog unosa). Ovde se samo
// prikazuje; kaucija se ne prikazuje. Ranije zabeležene stavke ostaju vidljive.
export default function Payments({ reservation: r, payments }) {
  const rows = payments.filter((p) => p.kind === 'payment' || p.kind === 'refund');
  const paid = Number(r.net_paid);

  let summary;
  if (paid > 0) {
    const last = rows.find((p) => p.kind === 'payment' && !p.voided_at);
    summary = (
      <p className="admin-collected">
        <span className="admin-muted">Naplaćeno</span>
        <strong>{formatMoney(paid)}</strong>
        {last && (
          <span className="admin-muted">
            {PAYMENT_METHODS[last.method] ?? last.method} ·{' '}
            {r.picked_up_at ? formatDateTime(r.picked_up_at) : formatDate(last.paid_at)}
          </span>
        )}
      </p>
    );
  } else if (r.status === 'confirmed') {
    summary = (
      <p className="admin-muted">
        Još nije naplaćeno. Kupac plaća ceo iznos pri preuzimanju — naplata se upisuje klikom na „Vozilo preuzeto“.
      </p>
    );
  } else {
    summary = <p className="admin-muted">Nema naplate.</p>;
  }

  return (
    <section className="admin-panel">
      <h2 className="admin-panel__title">Naplata</h2>
      {summary}

      {rows.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--responsive">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Vrsta</th>
                <th>Način</th>
                <th>Iznos</th>
                <th>Napomena</th>
                <th>Uneo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={p.voided_at ? 'admin-row--cancelled' : undefined}>
                  <td data-label="Datum">
                    <div>{formatDate(p.paid_at)}</div>
                  </td>
                  <td data-label="Vrsta">
                    <div>
                      {PAYMENT_KINDS[p.kind] ?? p.kind}
                      {p.voided_at && <span className="admin-muted"> · poništeno</span>}
                    </div>
                  </td>
                  <td data-label="Način">
                    <div>{PAYMENT_METHODS[p.method] ?? p.method}</div>
                  </td>
                  <td data-label="Iznos">
                    <div className="admin-nowrap">
                      <strong>{p.kind === 'refund' ? `−${formatMoney(p.amount)}` : formatMoney(p.amount)}</strong>
                    </div>
                  </td>
                  <td data-label="Napomena">
                    <div>{p.note || '—'}</div>
                  </td>
                  <td data-label="Uneo">
                    <div className="admin-muted">
                      {actorLabel(p.created_by)}, {formatDateTime(p.created_at)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
