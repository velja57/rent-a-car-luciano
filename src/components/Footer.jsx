import { Link } from 'react-router';
import { COMPANY } from '../data/company';
import { PHONE_DISPLAY, PHONE_HREF } from '../data/rental';
import { useI18n } from '../i18n';
import { isWorkingNow } from '../lib/contact';

// Tehnički pregled Luciano deli zgradu i adresu sa Rent a Car-om — isti Instagram profil.
const INSTAGRAM_URL = 'https://www.instagram.com/luciano_tehnicki_pregled/';

const CONTACT_ICONS = {
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  phone: (
    <path
      d="M5 4h3.5l1.5 4-2 1.5a11 11 0 005.5 5.5l1.5-2 4 1.5V18a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"
      strokeLinejoin="round"
    />
  ),
  mail: (
    <>
      <path d="M4 6h16v12H4V6z" strokeLinejoin="round" />
      <path d="M4 7l8 6 8-6" strokeLinejoin="round" />
    </>
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
};

function ContactIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {CONTACT_ICONS[name]}
    </svg>
  );
}

export default function Footer() {
  const { t, paths } = useI18n();
  const workingNow = isWorkingNow();
  const mapQuery = encodeURIComponent(t.footer.address);
  const crossPromoImages = [
    { src: '/tehnicki-pregled/radionica.webp', alt: t.footer.crossPromoAltInterior },
    { src: '/tehnicki-pregled/zgrada.webp', alt: t.footer.crossPromoAltExterior, className: 'site-footer__crosspromo-building' },
    { src: '/tehnicki-pregled/bmw-i3.jpg', alt: t.footer.crossPromoAltBmw },
    { src: '/tehnicki-pregled/golf.jpg', alt: t.footer.crossPromoAltGolf },
  ];

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
          <a href="tel:+381604848086">
            <ContactIcon name="phone" />
            060 484 8086
          </a>
          <a href="mailto:luciano@gmail.com">
            <ContactIcon name="mail" />
            luciano@gmail.com
          </a>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
            <ContactIcon name="instagram" />
            Instagram
          </a>
        </div>
      </div>

      <nav className="container site-footer__legal" aria-label={t.footer.legalLabel}>
        <Link to={paths.terms}>{t.footer.terms}</Link>
        <Link to={paths.privacy}>{t.footer.privacy}</Link>
      </nav>

      <div className="site-footer__map">
        <iframe
          className="site-footer__map-frame"
          src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
          title={t.footer.mapTitle}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <div className="container site-footer__map-inner">
          <div className="site-footer__panel">
            <h2 className="site-footer__panel-title">{t.footer.whereTitle}</h2>
            <ul className="site-footer__panel-contact">
              <li>
                <ContactIcon name="pin" />
                {t.footer.address}
              </li>
              <li>
                <ContactIcon name="phone" />
                <a href={PHONE_HREF}>{PHONE_DISPLAY}</a>
              </li>
              <li>
                <ContactIcon name="mail" />
                <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
              </li>
            </ul>

            <h2 className="site-footer__panel-title">{t.footer.hoursTitle}</h2>
            <dl className="site-footer__panel-hours">
              {t.footer.hoursRows.map(([days, time]) => (
                <div key={days}>
                  <dt>{days}</dt>
                  <dd>{time}</dd>
                </div>
              ))}
            </dl>

            <a
              className="site-footer__directions"
              href={`https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.footer.directions} →
            </a>
          </div>
        </div>
      </div>

      <div className="container site-footer__crosspromo">
        <span className="site-footer__crosspromo-eyebrow">{t.footer.crossPromoEyebrow}</span>
        <p className="site-footer__crosspromo-title">{t.footer.crossPromoTitle}</p>
        <p className="site-footer__crosspromo-message">{t.footer.crossPromoMessage}</p>
        <div className="site-footer__crosspromo-images">
          {crossPromoImages.map((img) => (
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={img.className}
              key={img.src}
            >
              <img src={img.src} alt={img.alt} loading="lazy" />
            </a>
          ))}
        </div>
        <a className="site-footer__crosspromo-cta" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" stroke="none" />
          </svg>
          {t.footer.crossPromoCta}
        </a>
        <span className="site-footer__crosspromo-handle">{t.footer.crossPromoHandle}</span>
      </div>

      <p className="site-footer__copy">
        © {new Date().getFullYear()} Luciano Rent a Car. {t.footer.rights}
      </p>
    </footer>
  );
}
