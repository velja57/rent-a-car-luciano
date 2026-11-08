import { useEffect, useState } from 'react';
import { BRAND, LANGUAGES, NAV_LINKS, PATHS, PHONE_HREF } from '../hero.config';
import { useI18n } from '../i18n';
import { useCallNotice } from '../lib/useCallNotice';
import AppLink from './AppLink';
import CallNotice from './CallNotice';

function LanguageSwitch({ className }) {
  const { lang, t, setLang } = useI18n();
  if (LANGUAGES.length < 2) return null;

  return (
    <div className={`lang-switch ${className}`} role="group" aria-label={t.nav.language}>
      {LANGUAGES.map((l) => (
        <a
          key={l.id}
          href={PATHS[l.id].home}
          onClick={(e) => {
            e.preventDefault();
            setLang(l.id);
          }}
          className={`lang-switch__option${l.id === lang ? ' lang-switch__option--active' : ''}`}
          aria-current={l.id === lang ? 'true' : undefined}
          aria-label={l.name}
          hrefLang={l.id}
          lang={l.id}
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}

export default function SiteHeader() {
  const { lang, t, paths } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { showCallNotice, handleCallClick, handleMouseLeave } = useCallNotice();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Mobilni meni se zatvara pri promeni jezika i na Escape.
  useEffect(() => {
    setMenuOpen(false);
  }, [lang]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  // Klik na početnu dok smo već na njoj: bez ponovnog učitavanja, samo na vrh.
  const goHome = (e) => {
    setMenuOpen(false);
    if (window.location.pathname === paths.home) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Logo na početnoj ne radi ništa (kao na sajtu), a sa druge strane vodi na nju.
  const onLogo = (e) => {
    setMenuOpen(false);
    if (window.location.pathname === paths.home) e.preventDefault();
  };

  const links = NAV_LINKS.map((id) => (
    <AppLink
      key={id}
      href={paths[id]}
      className={id === 'home' ? 'active' : undefined}
      aria-current={id === 'home' ? 'page' : undefined}
      onClick={id === 'home' ? goHome : closeMenu}
    >
      {t.nav[id]}
    </AppLink>
  ));

  return (
    <header
      className={`site-header${scrolled ? ' site-header--scrolled' : ''}${menuOpen ? ' site-header--menu-open' : ''}`}
    >
      <div className="site-header__inner container">
        <AppLink className="site-header__logo" href={paths.home} onClick={onLogo}>
          {BRAND.logoImage ? (
            <img className="site-header__logo-image" src={BRAND.logoImage} alt={BRAND.logoAlt} />
          ) : (
            <>
              {`${BRAND.name} `}
              <span>{BRAND.accent}</span>
            </>
          )}
        </AppLink>
        <nav className="site-header__nav" aria-label={t.nav.mainMenu}>
          {links}
        </nav>
        <div className="site-header__actions">
          <LanguageSwitch className="lang-switch--header" />
          <div className="site-header__call" onMouseLeave={handleMouseLeave}>
            <a className="site-header__cta" href={PHONE_HREF} onClick={handleCallClick}>
              {t.nav.call}
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
