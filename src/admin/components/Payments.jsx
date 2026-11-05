import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from './Toast';
import { adminApi } from '../lib/adminApi';
import { formatDate, formatDateTime, formatMoney, todayBelgrade } from '../lib/format';
import { actorLabel, PAYMENT_KINDS, PAYMENT_METHODS } from '../lib/labels';

const EMPTY = { kind: 'payment', amount: '', method: 'cash', paidAt: '', note: '' };

// Ručno zabeležen novac uz rezervaciju (nema online plaćanja): uplate i avansi,
// povraćaji i kaucija. Vrednost rezervacije nije isto što i naplaćeno —
// "Naplaćeno" su samo zabeležene uplate (minus povraćaji); kaucija nije prihod.
export default function Payments({ reservation: r, payments, onChange }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({ ...EMPTY, paidAt: todayBelgrade() }));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [voiding, setVoiding] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setError(null);
  };

  const add = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.amount || !Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      setError('Upiši iznos veći od 0.');
      return;
    }
    setSaving(true);
    try {
      // Uplata uvek nosi datum preuzimanja vozila (isto pravilo važi i u bazi).
      const paidAt = form.kind === 'payment' ? r.pickup_date : form.paidAt;
      await adminApi.addPayment({ reservationId: r.id, ...form, paidAt, amount });
      toast.success(`Zabeleženo: ${PAYMENT_KINDS[form.kind]} ${formatMoney(amount)}.`);
      setForm({ ...EMPTY, paidAt: todayBelgrade() });
      onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmVoid = async () => {
    setBusy(true);
    try {
      await adminApi.voidPayment(voiding.id);
      toast.success('Stavka je poništena.');
      onChange();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      setVoiding(null);
    }
  };

  const balance = r.balance === null ? null : Number(r.balance);

  return (
    <section className="admin-panel">
      <h2 className="admin-panel__title">Uplate</h2>

      <div className="admin-money">
        <div>
          <span className="admin-muted">Vrednost rezervacije</span>
          <strong>{formatMoney(r.total_price)}</strong>
        </div>
        <div>
          <span className="admin-muted">Naplaćeno</span>
          <strong>{formatMoney(r.net_paid)}</strong>
        </div>
        <div>
          <span className="admin-muted">{balance !== null && balance < 0 ? 'Preplaćeno' : 'Preostalo'}</span>
          <strong className={balance > 0 ? 'admin-warning' : undefined}>
            {balance === null ? '—' : formatMoney(Math.abs(balance))}
          </strong>
        </div>
        <div>
          <span className="admin-muted">Kaucija kod nas</span>
          <strong>{formatMoney(r.deposit_held)}</strong>
        </div>
      </div>

      {payments.length > 0 && (
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
                <th />
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className={p.voided_at ? 'admin-row--cancelled' : undefined}>
                  <td data-label="Datum">
                    <div>{formatDate(p.paid_at)}</div>
                  </td>
                  <td data-label="Vrsta">
                    <div>{PAYMENT_KINDS[p.kind] ?? p.kind}</div>
                  </td>
                  <td data-label="Način">
                    <div>{PAYMENT_METHODS[p.method] ?? p.method}</div>
                  </td>
                  <td data-label="Iznos">
                    <div className="admin-nowrap">
                      <strong>{formatMoney(p.amount)}</strong>
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
                  <td data-label="">
                    <div>
                      {p.voided_at ? (
                        <span className="admin-muted">poništeno</span>
                      ) : (
                        <button type="button" className="admin-btn admin-btn--small" onClick={() => setVoiding(p)}>
                          Poništi
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form className="admin-payment-form" onSubmit={add} noValidate>
        <label className="admin-field">
          <span>Vrsta</span>
          <select value={form.kind} onChange={set('kind')}>
            {Object.entries(PAYMENT_KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Iznos (€)</span>
          <input type="number" inputMode="decimal" min="0" step="0.01" value={form.amount} onChange={set('amount')} />
        </label>
        <label className="admin-field">
          <span>Način</span>
          <select value={form.method} onChange={set('method')}>
            {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {form.kind === 'payment' ? (
          <div className="admin-field">
            <span>Datum</span>
            <p className="admin-payment-form__date">
              {formatDate(r.pickup_date)} <small className="admin-muted">preuzimanje</small>
            </p>
          </div>
        ) : (
          <label className="admin-field">
            <span>Datum</span>
            <input type="date" value={form.paidAt} onChange={set('paidAt')} />
          </label>
        )}
        <label className="admin-field admin-payment-form__note">
          <span>Napomena (opciono)</span>
          <input type="text" value={form.note} onChange={set('note')} />
        </label>
        <button type="submit" className="admin-btn admin-btn--accent" disabled={saving}>
          {saving ? 'Čuvam…' : 'Zabeleži'}
        </button>
      </form>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <p className="admin-muted admin-hint">
        Uplate se beleže ručno (nema online plaćanja). Povraćaj umanjuje prihod u analitici; kaucija se vodi odvojeno i
        nije prihod. Pogrešna stavka se poništava, ne briše.
      </p>

      {voiding && (
        <ConfirmDialog
          title="Poništiti stavku?"
          text={`${PAYMENT_KINDS[voiding.kind]} ${formatMoney(voiding.amount)} od ${formatDate(voiding.paid_at)} ostaje zabeležena kao poništena i više se ne računa.`}
          confirmLabel="Poništi stavku"
          danger
          busy={busy}
          onConfirm={confirmVoid}
          onCancel={() => setVoiding(null)}
        />
      )}
    </section>
  );
}
