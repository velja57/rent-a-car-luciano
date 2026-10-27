import { useEffect, useRef } from 'react';
import { depositLabel } from '../lib/pricing';

export default function CarDetailsModal({ car, onClose, onReserve, triggerRef }) {
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

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button type="button" className="modal__close" aria-label="Zatvori" onClick={onClose} ref={closeButtonRef}>
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
          <div className="modal__spec">
            <span className="modal__spec-label">Godište</span>
            <span className="modal__spec-value">{car.year}.</span>
          </div>
          <div className="modal__spec">
            <span className="modal__spec-label">Menjač</span>
            <span className="modal__spec-value">{car.transmission}</span>
          </div>
          <div className="modal__spec">
            <span className="modal__spec-label">Gorivo</span>
            <span className="modal__spec-value">{car.fuel}</span>
          </div>
          <div className="modal__spec">
            <span className="modal__spec-label">Broj vrata</span>
            <span className="modal__spec-value">{car.doors}</span>
          </div>
          <div className="modal__spec">
            <span className="modal__spec-label">Broj mesta</span>
            <span className="modal__spec-value">{car.seats}</span>
          </div>
          <div className="modal__spec">
            <span className="modal__spec-label">Prtljažnik</span>
            <span className="modal__spec-value">{car.luggage}</span>
          </div>
          <div className="modal__spec">
            <span className="modal__spec-label">Kilometraža</span>
            <span className="modal__spec-value">{car.mileage}</span>
          </div>
          <div className="modal__spec">
            <span className="modal__spec-label">Minimalni uzrast</span>
            <span className="modal__spec-value">{car.minAge} god.</span>
          </div>
          <div className="modal__spec">
            <span className="modal__spec-label">Depozit</span>
            <span className="modal__spec-value">{depositLabel(car.deposit)}</span>
          </div>
          <div className="modal__spec modal__spec--wide">
            <span className="modal__spec-label">Otkazivanje</span>
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
            <span className="car-form__price-value">{car.pricePerDay}€</span>
            <span className="car-form__price-unit">/ dan</span>
          </div>
          <button type="button" className="car-form__cta" onClick={onReserve}>
            Rezerviši odmah
          </button>
        </div>
      </div>
    </div>
  );
}
