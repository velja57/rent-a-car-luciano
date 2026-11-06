import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { usePriceList } from '../lib/priceList';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import AdminLayout from './components/AdminLayout';
import { ToastProvider } from './components/Toast';
import { adminApi } from './lib/adminApi';
import Analytics from './pages/Analytics';
import Calendar from './pages/Calendar';
import Overview from './pages/Overview';
import ReservationDetail from './pages/ReservationDetail';
import ReservationForm from './pages/ReservationForm';
import Reservations from './pages/Reservations';
import VehicleDetail from './pages/VehicleDetail';
import Vehicles from './pages/Vehicles';

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

function Message({ title, text, onSignOut }) {
  return (
    <div className="admin-shell">
      <div className="admin-card">
        <h1>{title}</h1>
        <p className="admin-muted">{text}</p>
        {onSignOut && (
          <button type="button" className="admin-btn admin-btn--primary" onClick={onSignOut}>
            Odjavi se
          </button>
        )}
      </div>
    </div>
  );
}

// Posle prijave: da li nalog ima admin pristup (proverava baza, is_admin()).
// Same funkcije u bazi to ponovo proveravaju pri svakom pozivu — ovo je samo
// da se umesto praznih stranica prikaže jasna poruka.
function AdminPanel({ session }) {
  const [access, setAccess] = useState('checking'); // checking | ok | denied | error
  // Cene vozila i dodataka iz baze (forme i predlozi prikazuju aktuelni cenovnik).
  usePriceList();
  const userId = session.user.id;
  const signOut = () => supabase.auth.signOut();

  useEffect(() => {
    let cancelled = false;
    adminApi
      .isAdmin()
      .then((ok) => !cancelled && setAccess(ok ? 'ok' : 'denied'))
      .catch(() => !cancelled && setAccess('error'));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (access === 'checking') {
    return (
      <div className="admin-shell">
        <p className="admin-muted">Učitavanje…</p>
      </div>
    );
  }
  if (access === 'denied') {
    return <Message title="Nema pristupa" text={`Nalog ${session.user.email} nema pristup admin panelu.`} onSignOut={signOut} />;
  }
  if (access === 'error') {
    return <Message title="Greška" text="Veza sa bazom nije uspela. Osveži stranicu ili pokušaj kasnije." onSignOut={signOut} />;
  }

  return (
    <ToastProvider>
      <HashRouter>
        <Routes>
          <Route element={<AdminLayout email={session.user.email} onSignOut={signOut} />}>
            <Route index element={<Overview />} />
            <Route path="rezervacije" element={<Reservations />} />
            <Route path="rezervacije/nova" element={<ReservationForm />} />
            <Route path="rezervacije/:id" element={<ReservationDetail />} />
            <Route path="rezervacije/:id/izmena" element={<ReservationForm />} />
            <Route path="kalendar" element={<Calendar />} />
            <Route path="vozila" element={<Vehicles />} />
            <Route path="vozila/:carId" element={<VehicleDetail />} />
            <Route path="analitika" element={<Analytics />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ToastProvider>
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

  return <AdminPanel session={session} />;
}
