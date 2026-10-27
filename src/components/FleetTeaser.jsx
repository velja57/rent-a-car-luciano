import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router';
import { fleet } from '../data/fleet';
import { useI18n } from '../i18n';
import { formatEur, lowestRate, MAX_DISCOUNT_PERCENT } from '../lib/pricing';
import FleetCard from './FleetCard';
import ReservationModal from './ReservationModal';
import './Fleet.css';

const featured = fleet.filter((c) => c.featured);
const minPrice = Math.min(...fleet.map(lowestRate));

// Izdvojena vozila na početnoj — cela flota je na stranici /vozila.
export default function FleetTeaser() {
  const { lang, t, paths } = useI18n();
  const [reservationCar, setReservationCar] = useState(null);
  // Dugme koje je otvorilo formu — fokus mu se vraća kad se forma zatvori.
  const triggerRef = useRef(null);

  const openReservation = (car, trigger) => {
    triggerRef.current = trigger;
    setReservationCar(car);
  };
  const closeReservation = useCallback(() => setReservationCar(null), []);

  return (
    <section id="flota" className="fleet" aria-labelledby="fleet-title">
      <div className="fleet__bg" aria-hidden="true" />

      <div className="container fleet__inner">
        <header className="fleet__head fleet-teaser__head">
          <div>
            <span className="fleet__eyebrow">
              <span className="fleet__pulse" />
              {t.teaser.eyebrow}
            </span>
            <h2 className="fleet__title" id="fleet-title">
              {t.teaser.title[0]}
              <span>{t.teaser.title[1]}</span>
            </h2>
            <p className="fleet__subtitle">{t.teaser.subtitle}</p>
            <ul className="fleet__stats">
              <li className="fleet__stat">
                <strong>{fleet.length}</strong> {t.teaser.statModels}
              </li>
              <li className="fleet__stat">
                {t.teaser.statFrom} <strong>{formatEur(minPrice, lang)}</strong> {t.common.perDay}
              </li>
              <li className="fleet__stat">
                {t.teaser.statUpTo} <strong>−{MAX_DISCOUNT_PERCENT}%</strong> {t.teaser.statLongRental}
              </li>
            </ul>
          </div>
          <Link className="fleet-teaser__all" to={paths.fleet}>
            {t.teaser.all(fleet.length)}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </header>

        <ul className="fleet__grid fleet-teaser__grid">
          {featured.map((car, i) => (
            <FleetCard key={car.id} car={car} index={i} total={featured.length} onReserve={openReservation} />
          ))}
        </ul>

        <div className="fleet-teaser__cta">
          <Link className="car-form__cta" to={paths.fleet}>
            {t.teaser.cta}
          </Link>
          <p>{t.teaser.ctaText}</p>
        </div>
      </div>

      {reservationCar && (
        <ReservationModal car={reservationCar} onClose={closeReservation} triggerRef={triggerRef} />
      )}
    </section>
  );
}
