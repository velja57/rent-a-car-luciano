import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { PHONE_HREF } from '../data/rental';

// "Zašto mi" je na početnoj; "Kontakt" je footer, koji postoji na svakoj stranici.
const NAV_LINKS = [
  { label: 'Početna', to: '/', end: true },
  { label: 'Vozila', to: '/vozila' },
  { label: 'Zašto mi', to: { pathname: '/', hash: '#zasto-mi' }, plain: true },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Mobilni meni se zatvara pri promeni stranice i na Escape.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.key]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const links = NAV_LINKS.map((link) =>
    link.plain ? (
      <Link key={link.label} to={link.to}>
        {link.label}
      </Link>
    ) : (
      <NavLink key={link.label} to={link.to} end={link.end}>
        {link.label}
      </NavLink>
    ),
  );
  const contactLink = (
    <a href="#kontakt" onClick={() => setMenuOpen(false)}>
      Kontakt
    </a>
  );

  return (
    <header
      className={`site-header${scrolled ? ' site-header--scrolled' : ''}${menuOpen ? ' site-header--menu-open' : ''}`}
    >
      <div className="site-header__inner container">
        <Link className="site-header__logo" to="/">
          Luciano <span>Rent a Car</span>
        </Link>
        <nav className="site-header__nav" aria-label="Glavni meni">
          {links}
          {contactLink}
        </nav>
        <div className="site-header__actions">
          <a className="site-header__cta" href={PHONE_HREF}>
            Pozovi nas
          </a>
          <button
            type="button"
            className="site-header__menu-btn"
            aria-label={menuOpen ? 'Zatvori meni' : 'Otvori meni'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      <nav id="mobile-menu" className="site-header__mobile" aria-label="Meni" hidden={!menuOpen}>
        <div className="container site-header__mobile-inner">
          {links}
          {contactLink}
        </div>
      </nav>
    </header>
  );
}
