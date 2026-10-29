import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';

const ICONS = {
  overview: <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" strokeLinejoin="round" />,
  reservations: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeLinecap="round" />,
  calendar: (
    <path d="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zM8 12h3M8 16h6" strokeLinecap="round" />
  ),
  vehicles: (
    <path
      d="M5 16v2M19 16v2M3 13l2-5.5A2 2 0 016.9 6h10.2a2 2 0 011.9 1.5L21 13v3H3zM3 13h18M7 13.5h.01M17 13.5h.01"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  plus: <path d="M12 5v14M5 12h14" strokeLinecap="round" />,
  site: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" strokeLinecap="round" strokeLinejoin="round" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />,
};

export function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const NAV = [
  { to: '/', label: 'Pregled', icon: 'overview', end: true },
  { to: '/rezervacije', label: 'Rezervacije', icon: 'reservations' },
  { to: '/kalendar', label: 'Kalendar', icon: 'calendar' },
  { to: '/vozila', label: 'Vozila', icon: 'vehicles' },
];

// Bočni meni (na telefonu se otvara kao fioka) + sadržaj stranice.
export default function AdminLayout({ email, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (e) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <div className="admin-layout">
      <header className="admin-topbar">
        <button
          type="button"
          className="admin-topbar__menu"
          aria-label="Otvori meni"
          aria-expanded={menuOpen}
          aria-controls="admin-sidebar"
          onClick={() => setMenuOpen(true)}
        >
          <Icon name="menu" />
        </button>
        <span className="admin-brand">
          Luciano <span>Admin</span>
        </span>
      </header>

      <aside id="admin-sidebar" className={`admin-sidebar${menuOpen ? ' admin-sidebar--open' : ''}`}>
        <span className="admin-brand admin-sidebar__brand">
          Luciano <span>Admin</span>
        </span>
        <nav className="admin-nav" aria-label="Admin meni">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="admin-nav__link">
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/rezervacije/nova" className="admin-nav__link admin-nav__link--cta">
            <Icon name="plus" />
            Nova rezervacija
          </NavLink>
        </nav>
        <div className="admin-sidebar__foot">
          <a className="admin-nav__link" href="/" target="_blank" rel="noopener noreferrer">
            <Icon name="site" />
            Otvori sajt
          </a>
          <p className="admin-sidebar__user" title={email}>
            {email}
          </p>
          <button type="button" className="admin-btn admin-btn--block" onClick={onSignOut}>
            Odjavi se
          </button>
        </div>
      </aside>
      {menuOpen && <div className="admin-backdrop" onClick={() => setMenuOpen(false)} />}

      <main className="admin-main">
        {/* key: nova stranica = nov prikaz (npr. iz izmene u novu rezervaciju bez starih podataka). */}
        <Outlet key={location.pathname} />
      </main>
    </div>
  );
}
