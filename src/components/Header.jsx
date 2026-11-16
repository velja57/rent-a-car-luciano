import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { PHONE_HREF } from '../data/rental';
import { useI18n } from '../i18n';
import { translatePath } from '../i18n/routes';
import CallNotice from './CallNotice';
import { useCallNotice } from '../lib/useCallNotice';

const LANGUAGES = [
  { id: 'sr', label: 'SR', name: 'Srpski' },
  { id: 'en', label: 'EN', name: 'English' },
];

// Ista stranica na drugom jeziku; datumi/filteri (search) i mesto na stranici ostaju.
function LanguageSwitch({ className }) {
  const { lang, t } = useI18n();
  const { pathname, search, hash } = useLocation();

  return (
    <div className={`lang-switch ${className}`} role="group" aria-label={t.nav.language}>
      {LANGUAGES.map((l) => (
        <Link
          key={l.id}
          to={{ pathname: translatePath(pathname, l.id), search, hash }}
          state={{ keepScroll: true }}
          className={`lang-switch__option${l.id === lang ? ' lang-switch__option--active' : ''}`}
          aria-current={l.id === lang ? 'true' : undefined}
          aria-label={l.name}
          hrefLang={l.id}
          lang={l.id}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}

export default function Header() {
  const { t, paths } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { showCallNotice, handleCallClick, handleMouseLeave } = useCallNotice();

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

  // Klik na "Početna" dok smo već na toj stranici ne menja URL, pa ScrollManager
  // ne bi inače pomerio skrol — zato ovde eksplicitno vraćamo na vrh.
  const goHome = () => {
    setMenuOpen(false);
    if (location.pathname === paths.home) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // "Zašto mi" je na početnoj; "Kontakt" je footer, koji postoji na svakoj stranici.
  const links = (
    <>
      <NavLink to={paths.home} end onClick={goHome}>
        {t.nav.home}
      </NavLink>
      <NavLink to={paths.fleet}>{t.nav.fleet}</NavLink>
      <Link to={{ pathname: paths.home, hash: '#zasto-mi' }}>{t.nav.whyUs}</Link>
      <NavLink to={paths.terms}>{t.nav.terms}</NavLink>
      <a href="#kontakt" onClick={() => setMenuOpen(false)}>
        {t.nav.contact}
      </a>
    </>
  );

  return (
    <header
      className={`site-header${scrolled ? ' site-header--scrolled' : ''}${menuOpen ? ' site-header--menu-open' : ''}`}
    >
      <div className="site-header__inner container">
        <Link className="site-header__logo" to={paths.home}>
          Luciano <span>Rent a Car</span>
        </Link>
        <nav className="site-header__nav" aria-label={t.nav.mainMenu}>
          {links}
        </nav>
        <div className="site-header__actions">
          <LanguageSwitch className="lang-switch--header" />
          <div className="site-header__call" onMouseLeave={handleMouseLeave}>
            <a className="site-header__cta" href={PHONE_HREF} onClick={handleCallClick} aria-label={t.nav.call}>
              {/* Ikonica i kratak tekst vide se samo na telefonu (App.css). */}
              <svg className="site-header__cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path
                  d="M5 4h3.5l1.5 4-2 1.5a11 11 0 005.5 5.5l1.5-2 4 1.5V18a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="site-header__cta-full">{t.nav.call}</span>
              <span className="site-header__cta-short">{t.nav.callShort}</span>
            </a>
            {showCallNotice && <CallNotice className="call-notice call-notice--popover" />}
          </div>
          <button
            type="button"
            className="site-header__menu-btn"
            aria-label={menuOpen ? t.nav.closeMenu : t.nav.openMenu}
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

      <nav id="mobile-menu" className="site-header__mobile" aria-label={t.nav.menu} hidden={!menuOpen}>
        <div className="container site-header__mobile-inner">
          {links}
          <LanguageSwitch className="lang-switch--mobile" />
        </div>
      </nav>
    </header>
  );
}
