import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { fleet } from '../data/fleet';
import CarDetailsModal from './CarDetailsModal';
import ReservationModal from './ReservationModal';

export default function CarSelectForm({ cars, selectedId, onChange, isTransitioning }) {
  const car = cars.find((c) => c.id === selectedId);
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
      <span className="car-form__eyebrow">Rezervacija</span>
      <h1 className="car-form__title">Izaberi svoje vozilo</h1>
      <p className="car-form__subtitle">
        Pogledaj dostupna vozila i karakteristike pre nego što rezervišeš.
      </p>

      <label className="car-form__label" htmlFor="car-select">
        Vozilo
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
              {c.comingSoon ? ' — Uskoro dostupno' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="car-form__specs" aria-live="polite" key={`specs-${selectedId}`}>
        <div className="car-form__spec">
          <span className="car-form__spec-label">Kategorija</span>
          <span className="car-form__spec-value">{car.category}</span>
        </div>
        <div className="car-form__spec">
          <span className="car-form__spec-label">Menjač</span>
          <span className="car-form__spec-value">{car.transmission}</span>
        </div>
        <div className="car-form__spec">
          <span className="car-form__spec-label">Gorivo</span>
          <span className="car-form__spec-value">{car.fuel}</span>
        </div>
        <div className="car-form__spec">
          <span className="car-form__spec-label">Broj mesta</span>
          <span className="car-form__spec-value">{car.seats}</span>
        </div>
      </div>

      <div className="car-form__footer">
        <div className="car-form__price" key={`price-${selectedId}`}>
          <span className="car-form__price-value">{car.pricePerDay}€</span>
          <span className="car-form__price-unit">/ dan</span>
        </div>
        <button type="button" className="car-form__cta" ref={reserveButtonRef} onClick={openReservation}>
          Rezerviši odmah
        </button>
      </div>

      <button
        type="button"
        className="car-form__more"
        ref={detailsButtonRef}
        onClick={() => setShowDetails(true)}
      >
        Više informacija o vozilu
      </button>

      <Link className="car-form__fleet-link" to="/vozila">
        Pogledaj svih {fleet.length} vozila u floti →
      </Link>

      <p className={`car-form__hint${isTransitioning ? ' car-form__hint--visible' : ''}`} aria-live="polite">
        Menjamo vozilo na prikazu…
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
