import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

function formatDate(iso) {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}.`;
}

function NotConfigured() {
  return (
    <div className="admin-shell">
      <div className="admin-card">
        <h1>Admin panel</h1>
        <p>
          Supabase nije podešen (nedostaju <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>).
          Vidi <code>README_RESERVATIONS.md</code> i <code>README_ADMIN.md</code>.
        </p>
      </div>
    </div>
  );
}

function LoginForm({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError('Pogrešan email ili lozinka.');
      return;
    }
    onSignedIn(data.session);
  };

  return (
    <div className="admin-shell">
      <form className="admin-card admin-login" onSubmit={handleSubmit}>
        <h1>Admin prijava</h1>
        <label className="admin-field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>
        <label className="admin-field">
          <span>Lozinka</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="admin-error">{error}</p>}
        <button type="submit" className="admin-btn admin-btn--primary" disabled={submitting}>
          {submitting ? 'Prijavljivanje…' : 'Prijavi se'}
        </button>
      </form>
    </div>
  );
}

function ReservationsPanel({ onSignOut }) {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const loadReservations = async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .order('pickup_date', { ascending: true });
    setLoading(false);
    if (error) {
      setLoadError('Ne mogu da učitam rezervacije. Pokušaj da osvežiš stranicu.');
      return;
    }
    setReservations(data ?? []);
  };

  useEffect(() => {
    loadReservations();
  }, []);

  const handleCancel = async (id) => {
    if (!window.confirm('Otkazati ovu rezervaciju?')) return;
    setCancellingId(id);
    const { data, error } = await supabase.rpc('cancel_reservation', { p_id: id });
    setCancellingId(null);
    if (error || !data?.success) {
      window.alert('Otkazivanje nije uspelo. Pokušaj ponovo.');
      return;
    }
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)));
  };

  return (
    <div className="admin-shell admin-shell--wide">
      <div className="admin-header">
        <h1>Rezervacije</h1>
        <button type="button" className="admin-btn" onClick={onSignOut}>
          Odjavi se
        </button>
      </div>

      {loading && <p className="admin-muted">Učitavanje…</p>}
      {loadError && <p className="admin-error">{loadError}</p>}

      {!loading && !loadError && reservations.length === 0 && <p className="admin-muted">Nema rezervacija.</p>}

      {!loading && !loadError && reservations.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Vozilo</th>
                <th>Kupac</th>
                <th>Kontakt</th>
                <th>Preuzimanje</th>
                <th>Vraćanje</th>
                <th>Lokacija</th>
                <th>Napomena</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id} className={r.status === 'cancelled' ? 'admin-row--cancelled' : ''}>
                  <td>{r.car_name}</td>
                  <td>{r.customer_name}</td>
                  <td>
                    <div>{r.phone}</div>
                    <div className="admin-muted">{r.email}</div>
                  </td>
                  <td>{formatDate(r.pickup_date)}</td>
                  <td>{formatDate(r.return_date)}</td>
                  <td>{r.pickup_location}</td>
                  <td>{r.note || '-'}</td>
                  <td>
                    <span className={`admin-status admin-status--${r.status}`}>
                      {r.status === 'cancelled' ? 'Otkazana' : 'Potvrđena'}
                    </span>
                  </td>
                  <td>
                    {r.status === 'confirmed' && (
                      <button
                        type="button"
                        className="admin-btn admin-btn--danger"
                        onClick={() => handleCancel(r.id)}
                        disabled={cancellingId === r.id}
                      >
                        {cancellingId === r.id ? 'Otkazujem…' : 'Otkaži'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminApp() {
  const [session, setSession] = useState(undefined); // undefined = učitavanje, null = odjavljen

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) return <NotConfigured />;
  if (session === undefined) {
    return (
      <div className="admin-shell">
        <p className="admin-muted">Učitavanje…</p>
      </div>
    );
  }
  if (!session) return <LoginForm onSignedIn={setSession} />;

  return <ReservationsPanel onSignOut={() => supabase.auth.signOut()} />;
}
