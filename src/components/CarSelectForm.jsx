import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { fleet } from '../data/fleet';
import { useI18n } from '../i18n';
import { formatEur } from '../lib/pricing';
import CarDetailsModal from './CarDetailsModal';
import ReservationModal from './ReservationModal';

export default function CarSelectForm({ cars, selectedId, onChange, isTransitioning }) {
  const { lang, t, paths, localize } = useI18n();
  const car = cars.find((c) => c.id === selectedId);
  const shown = localize(car);
  const [showDetails, setShowDetails] = useState(false);
  const [showReservation, setShowReservation] = useState(false);
  const detailsButtonRef = useRef(null);
  const reserveButtonRef = useRef(null);

  const openReservation = () => {
    setShowDetails(false);
    setShowReservation(true);
  };

  return (
    <div className="car-form">
      <span className="car-form__eyebrow">{t.hero.eyebrow}</span>
      <h1 className="car-form__title">{t.hero.title}</h1>
      <p className="car-form__subtitle">{t.hero.subtitle}</p>

      <label className="car-form__label" htmlFor="car-select">
        {t.hero.carLabel}
      </label>
      <div className="car-form__select-wrap">
        <select
          id="car-select"
          className="car-form__select"
          value={selectedId}
          onChange={(e) => onChange(e.target.value)}
        >
          {cars.map((c) => (
            <option key={c.id} value={c.id} disabled={c.comingSoon}>
              {c.name}
              {c.comingSoon ? t.hero.comingSoon : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="car-form__specs" aria-live="polite" key={`specs-${selectedId}`}>
        <div className="car-form__spec">
          <span className="car-form__spec-label">{t.specs.category}</span>
          <span className="car-form__spec-value">{shown.category}</span>
        </div>
        <div className="car-form__spec">
          <span className="car-form__spec-label">{t.specs.transmission}</span>
          <span className="car-form__spec-value">{shown.transmission}</span>
        </div>
        <div className="car-form__spec">
          <span className="car-form__spec-label">{t.specs.fuel}</span>
          <span className="car-form__spec-value">{shown.fuel}</span>
        </div>
        <div className="car-form__spec">
          <span className="car-form__spec-label">{t.specs.seats}</span>
          <span className="car-form__spec-value">{shown.seats}</span>
        </div>
      </div>

      <div className="car-form__footer">
        <div className="car-form__price" key={`price-${selectedId}`}>
          <span className="car-form__price-value">{formatEur(car.pricePerDay, lang)}</span>
          <span className="car-form__price-unit">{t.common.perDay}</span>
        </div>
        <button type="button" className="car-form__cta" ref={reserveButtonRef} onClick={openReservation}>
          {t.common.reserveNow}
        </button>
      </div>

      <button
        type="button"
        className="car-form__more"
        ref={detailsButtonRef}
        onClick={() => setShowDetails(true)}
      >
        {t.hero.moreInfo}
      </button>

      <Link className="car-form__fleet-link" to={paths.fleet}>
        {t.hero.fleetLink(fleet.length)}
      </Link>

      <p className={`car-form__hint${isTransitioning ? ' car-form__hint--visible' : ''}`} aria-live="polite">
        {t.hero.switching}
      </p>

      {showDetails && (
        <CarDetailsModal
          car={car}
          onClose={() => setShowDetails(false)}
          onReserve={openReservation}
          triggerRef={detailsButtonRef}
        />
      )}
      {showReservation && (
        <ReservationModal car={car} onClose={() => setShowReservation(false)} triggerRef={reserveButtonRef} />
      )}
    </div>
  );
}
