import { useEffect, useState } from 'react';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`site-header${scrolled ? ' site-header--scrolled' : ''}`}>
      <div className="site-header__inner container">
        <a className="site-header__logo" href="#top">
          Luciano <span>Rent a Car</span>
        </a>
        <nav className="site-header__nav">
          <a href="#top">Početna</a>
          <a href="#vozila">Vozila</a>
          <a href="#zasto-mi">Zašto mi</a>
          <a href="#kontakt">Kontakt</a>
        </nav>
        <a className="site-header__cta" href="tel:+381604848086">
          Pozovi nas
        </a>
      </div>
    </header>
  );
}
