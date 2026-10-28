import { Link } from 'react-router';
import { EXTRAS } from '../data/rental';
import { useI18n } from '../i18n';
import { whatsappUrl } from '../lib/contact';
import { formatEur } from '../lib/pricing';
import ResponseTime from './ResponseTime';
import './HomeSections.css';

const AIRPORT_PRICE = EXTRAS.find((e) => e.id === 'airport').price;

// Ponuda za goste koji sleću na aerodrom Nikola Tesla (dijaspora, stranci).
export default function AirportSection() {
  const { lang, t, paths } = useI18n();
  const a = t.airport;

  return (
    <section className="airport-section" aria-labelledby="airport-title">
      <div className="container">
        <div className="airport-card">
          <div className="airport-card__content">
            <span className="fleet__eyebrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path
                  d="M10.5 4.5L12 10l6.5-1.5a1.6 1.6 0 01.8 3.1L13 13.5l-1.5 6-2 .5.5-6.5-4 1-1 2-1.5.4.4-3.4-2-2 1.4-.6 2 1.2 4-1L7 5z"
                  strokeLinejoin="round"
                />
              </svg>
              {a.eyebrow}
            </span>
            <h2 className="fleet__title airport-card__title" id="airport-title">
              {a.title[0]}
              <span>{a.title[1]}</span>
            </h2>
            <p className="fleet__subtitle">{a.text}</p>

            <ul className="airport-card__points">
              {a.points(formatEur(AIRPORT_PRICE, lang)).map((point) => (
                <li key={point}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {point}
                </li>
              ))}
            </ul>

            <div className="airport-card__actions">
              <Link className="car-form__cta" to={paths.fleet}>
                {a.cta}
              </Link>
              <a
                className="airport-card__whatsapp"
                href={whatsappUrl(a.whatsappMessage)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {a.whatsapp}
              </a>
            </div>
            <ResponseTime />
          </div>

          {/* Ruta aerodrom -> vozilo, čisto dekorativno */}
          <div className="airport-card__visual" aria-hidden="true">
            <svg viewBox="0 0 320 240" fill="none">
              <circle cx="160" cy="120" r="108" className="airport-radar" />
              <circle cx="160" cy="120" r="72" className="airport-radar" />
              <circle cx="160" cy="120" r="36" className="airport-radar" />
              <path d="M60 180C100 60 220 60 262 150" className="airport-route" />
              <circle cx="60" cy="180" r="7" className="airport-dot" />
              <circle cx="262" cy="150" r="7" className="airport-dot airport-dot--end" />
              <text x="60" y="210" textAnchor="middle" className="airport-label">
                BEG
              </text>
              <text x="262" y="180" textAnchor="middle" className="airport-label">
                LUCIANO
              </text>
              <text x="160" y="72" textAnchor="middle" className="airport-label airport-label--time">
                30–45 MIN
              </text>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
