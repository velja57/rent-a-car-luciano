export default function Footer() {
  return (
    <footer id="kontakt" className="site-footer">
      <div className="container site-footer__inner">
        <div>
          <p className="site-footer__logo">Luciano Rent a Car</p>
          <p className="site-footer__text">Iznajmljivanje vozila novije generacije.</p>
          <p className="site-footer__text">Kralja Mihaila Zetskog 44, Batajnica, Beograd</p>
          <p className="site-footer__text">Radno vreme: 08:00 - 16:00 (radnim danima)</p>
        </div>
        <div className="site-footer__contact">
          <a href="tel:+381604848086">060 484 8086</a>
          <a href="mailto:luciano@gmail.com">luciano@gmail.com</a>
          <a href="https://www.instagram.com/luciano_tehnicki_pregled/" target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
        </div>
      </div>
      <p className="site-footer__copy">© {new Date().getFullYear()} Luciano Rent a Car. Sva prava zadržana.</p>
    </footer>
  );
}
