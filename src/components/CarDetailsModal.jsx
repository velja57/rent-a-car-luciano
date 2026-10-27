import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import { formatEur } from '../lib/pricing';

export default function CarDetailsModal({ car: rawCar, onClose, onReserve, triggerRef }) {
  const { lang, t, localize } = useI18n();
  const car = localize(rawCar);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
      triggerRef?.current?.focus();
    };
  }, [onClose, triggerRef]);

  const specs = [
    [t.specs.year, t.year(car.year)],
    [t.specs.transmission, car.transmission],
    [t.specs.fuel, car.fuel],
    [t.specs.doors, car.doors],
    [t.specs.seats, car.seats],
    [t.specs.trunk, car.luggage],
    [t.specs.mileage, car.mileage],
    [t.specs.minAge, t.common.minAge(car.minAge)],
    [t.specs.deposit, car.deposit ? formatEur(car.deposit, lang) : t.common.noDeposit],
  ];

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button
          type="button"
          className="modal__close"
          aria-label={t.common.close}
          onClick={onClose}
          ref={closeButtonRef}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>

        <span className="modal__eyebrow">{car.category}</span>
        <h2 className="modal__title" id="modal-title">
          {car.name}
        </h2>
        <p className="modal__description">{car.description}</p>

        <div className="modal__specs">
          {specs.map(([label, value]) => (
            <div className="modal__spec" key={label}>
              <span className="modal__spec-label">{label}</span>
              <span className="modal__spec-value">{value}</span>
            </div>
          ))}
          <div className="modal__spec modal__spec--wide">
            <span className="modal__spec-label">{t.specs.cancellation}</span>
            <span className="modal__spec-value">{car.cancellation}</span>
          </div>
        </div>

        <div className="modal__features">
          {car.features.map((f) => (
            <span className="modal__chip" key={f}>
              {f}
            </span>
          ))}
        </div>

        <div className="modal__footer">
          <div className="car-form__price">
            <span className="car-form__price-value">{formatEur(car.pricePerDay, lang)}</span>
            <span className="car-form__price-unit">{t.common.perDay}</span>
          </div>
          <button type="button" className="car-form__cta" onClick={onReserve}>
            {t.common.reserveNow}
          </button>
        </div>
      </div>
    </div>
  );
}
