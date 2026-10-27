import { useI18n } from '../i18n';

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer id="kontakt" className="site-footer">
      <div className="container site-footer__inner">
        <div>
          <p className="site-footer__logo">Luciano Rent a Car</p>
          <p className="site-footer__text">{t.footer.tagline}</p>
          <p className="site-footer__text">{t.footer.address}</p>
          <p className="site-footer__text">{t.footer.hours}</p>
        </div>
        <div className="site-footer__contact">
          <a href="tel:+381604848086">060 484 8086</a>
          <a href="mailto:luciano@gmail.com">luciano@gmail.com</a>
          <a href="https://www.instagram.com/luciano_tehnicki_pregled/" target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
        </div>
      </div>
      <p className="site-footer__copy">
        © {new Date().getFullYear()} Luciano Rent a Car. {t.footer.rights}
      </p>
    </footer>
  );
}
