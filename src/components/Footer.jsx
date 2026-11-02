import { useI18n } from '../i18n';
import { isWorkingNow } from '../lib/contact';

export default function Footer() {
  const { t } = useI18n();
  const workingNow = isWorkingNow();
  const mapQuery = encodeURIComponent(t.footer.address);

  return (
    <footer id="kontakt" className="site-footer">
      <div className="container site-footer__inner">
        <div>
          <p className="site-footer__logo">Luciano Rent a Car</p>
          <p className="site-footer__text">{t.footer.tagline}</p>
          <p className="site-footer__text">{t.footer.address}</p>
          <p className="site-footer__text">{t.footer.hours}</p>
          <span className={`site-footer__status${workingNow ? ' site-footer__status--open' : ''}`}>
            <i aria-hidden="true" />
            {workingNow ? t.footer.openNow : t.footer.closedNow}
          </span>
        </div>
        <div className="site-footer__contact">
          <a href="tel:+381604848086">060 484 8086</a>
          <a href="mailto:luciano@gmail.com">luciano@gmail.com</a>
          <a href="https://www.instagram.com/luciano_tehnicki_pregled/" target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
        </div>
      </div>

      <div className="container site-footer__map">
        <iframe
          className="site-footer__map-frame"
          src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
          title={t.footer.mapTitle}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <a
          className="site-footer__directions"
          href={`https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t.footer.directions} →
        </a>
      </div>

      <p className="site-footer__copy">
        © {new Date().getFullYear()} Luciano Rent a Car. {t.footer.rights}
      </p>
    </footer>
  );
}
