import { useCallback, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import DateRangeFields from '../components/DateRangeFields';
import DiscountLadder from '../components/DiscountLadder';
import FleetCard from '../components/FleetCard';
import ReservationModal from '../components/ReservationModal';
import VehicleGallery from '../components/VehicleGallery';
import { fleet } from '../data/fleet';
import { INCLUDED, PHONE_DISPLAY, PHONE_HREF, WHATSAPP_NUMBER } from '../data/rental';
import { depositLabel, formatDays, formatRsd, lowestRate, MAX_DISCOUNT_PERCENT, quote } from '../lib/pricing';
import { useAvailability } from '../lib/useAvailability';
import { usePageMeta } from '../lib/usePageMeta';
import { datesQuery, useRentalDates } from '../lib/useRentalDates';
import NotFoundPage from './NotFoundPage';
import '../components/Fleet.css';
import './VehiclePage.css';

const SIMILAR_COUNT = 3;

// Isti tip vozila prvo, pa najbliža cena.
function similarCars(car) {
  return fleet
    .filter((c) => c.id !== car.id)
    .sort(
      (a, b) =>
        Number(b.type === car.type) - Number(a.type === car.type) ||
        Math.abs(a.pricePerDay - car.pricePerDay) - Math.abs(b.pricePerDay - car.pricePerDay),
    )
    .slice(0, SIMILAR_COUNT);
}

export default function VehiclePage() {
  const { id } = useParams();
  const car = fleet.find((c) => c.id === id);
  if (!car) return <NotFoundPage />;
  // key: nova stranica vozila kreće od čistog stanja (galerija, forma).
  return <VehicleDetails key={car.id} car={car} />;
}

function VehicleDetails({ car }) {
  usePageMeta(
    `${car.name} — rent a car Beograd | Luciano Rent a Car`,
    `Iznajmi ${car.name} (${car.year}.) u Beogradu — ${car.transmission.toLowerCase()}, ${car.fuel.toLowerCase()}, ${car.seats} sedišta. Već od ${lowestRate(car)}€ po danu, neograničena kilometraža.`,
  );

  const { pickup, ret, days, setDates } = useRentalDates();
  const availability = useAvailability([car.id], pickup, ret);
  const [reservationCar, setReservationCar] = useState(null);
  // Dugme koje je otvorilo formu — fokus mu se vraća kad se forma zatvori.
  const triggerRef = useRef(null);
  const openReservation = (target, trigger) => {
    triggerRef.current = trigger;
    setReservationCar(target);
  };
  const closeReservation = useCallback(() => setReservationCar(null), []);

  const period = days > 0 ? quote(car, days) : null;
  const unavailable = availability.status === 'ready' && availability.byId[car.id] === false;
  const similar = similarCars(car);

  const specs = [
    ['Motor', car.engine],
    ['Snaga', `${car.power} KS`],
    ['Menjač', car.transmission],
    ['Gorivo', car.fuel],
    ['Pogon', car.drive],
    ['Potrošnja', car.consumption],
    ['Broj mesta', car.seats],
    ['Broj vrata', car.doors],
    ['Prtljažnik', `${car.trunk.toLocaleString('sr-RS')} L`],
    ['Prtljag', car.luggage],
  ];

  const terms = [
    ['Kilometraža', car.mileage],
    ['Depozit', depositLabel(car.deposit)],
    ['Minimalni uzrast vozača', `${car.minAge} god.`],
    ['Otkazivanje', car.cancellation],
  ];

  return (
    <div className="vehicle-page">
      <div className="fleet__bg" aria-hidden="true" />

      <div className="container vehicle-page__inner">
        <nav className="vehicle-page__crumbs" aria-label="Putanja">
          <Link to="/">Početna</Link>
          <span aria-hidden="true">/</span>
          <Link to={`/vozila${datesQuery(pickup, ret)}`}>Vozila</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{car.name}</span>
        </nav>

        <div className="vehicle-page__top">
          <VehicleGallery car={car} />

          <aside className="vehicle-panel" aria-labelledby="vehicle-title">
            <span className="modal__eyebrow">
              {car.category} · {car.year}.
            </span>
            <h1 className="vehicle-panel__title" id="vehicle-title">
              {car.name}
            </h1>
            <p className="vehicle-panel__engine">
              {car.engine} · {car.power} KS · {car.transmission} · {car.fuel}
            </p>
            <div className="vehicle-panel__badges">
              {car.recommended && <span className="vehicle-badge vehicle-badge--gold">★ Preporuka</span>}
              <span className={`vehicle-badge${car.deposit ? '' : ' vehicle-badge--ok'}`}>
                {car.deposit ? `Depozit ${depositLabel(car.deposit)}` : '✓ Bez depozita'}
              </span>
              <span className="vehicle-badge">Neograničena kilometraža</span>
            </div>

            <div className="vehicle-panel__price">
              {period ? (
                <>
                  <span className="vehicle-panel__price-label">
                    Ukupno za {days} {formatDays(days)}
                  </span>
                  <span className="vehicle-panel__price-main">
                    <strong>{period.total}€</strong>
                    {period.savings > 0 && <s>{car.pricePerDay * days}€</s>}
                  </span>
                  <span className="vehicle-panel__price-sub">
                    {period.rate}€ / dan · ≈ {formatRsd(period.total)}
                    {period.savings > 0 && ` · ušteda ${period.savings}€`}
                  </span>
                </>
              ) : (
                <>
                  <span className="vehicle-panel__price-label">Već od</span>
                  <span className="vehicle-panel__price-main">
                    <strong>{lowestRate(car)}€</strong>
                    <span>/ dan</span>
                  </span>
                  <span className="vehicle-panel__price-sub">
                    {car.pricePerDay}€ / dan za 1–2 dana · ≈ {formatRsd(car.pricePerDay)} · do −{MAX_DISCOUNT_PERCENT}% za
                    duži najam
                  </span>
                </>
              )}
            </div>

            <DateRangeFields pickup={pickup} ret={ret} onChange={setDates} />

            {days > 0 && availability.status !== 'idle' && (
              <p className={`vehicle-panel__availability vehicle-panel__availability--${unavailable ? 'busy' : availability.status}`} aria-live="polite">
                {availability.status === 'checking' && 'Proveravamo dostupnost…'}
                {availability.status === 'ready' && !unavailable && 'Vozilo je slobodno za izabrane datume.'}
                {unavailable && 'Vozilo je zauzeto u tom periodu — izaberi druge datume ili slično vozilo ispod.'}
                {availability.status === 'error' && 'Dostupnost trenutno ne možemo da proverimo.'}
              </p>
            )}

            <button
              type="button"
              className="car-form__cta vehicle-panel__cta"
              disabled={unavailable}
              onClick={(e) => openReservation(car, e.currentTarget)}
            >
              {days > 0 ? `Rezerviši za ${period.total}€` : 'Rezerviši odmah'}
            </button>
            <div className="vehicle-panel__contact">
              <a href={PHONE_HREF}>Pozovi {PHONE_DISPLAY}</a>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </div>

            <ul className="vehicle-panel__included">
              {INCLUDED.map((item) => (
                <li key={item}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <section className="vehicle-section">
          <h2 className="vehicle-section__title">O vozilu</h2>
          <p className="vehicle-section__lead">{car.description}</p>
          <div className="vehicle-specs">
            {specs.map(([label, value]) => (
              <div className="vehicle-spec" key={label}>
                <span className="vehicle-spec__label">{label}</span>
                <span className="vehicle-spec__value">{value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="vehicle-section">
          <h2 className="vehicle-section__title">Cena po dužini najma</h2>
          <p className="vehicle-section__lead">Popust se automatski uračunava kad izabereš datume.</p>
          <DiscountLadder days={days} car={car} />
        </section>

        <div className="vehicle-section vehicle-section--split">
          <section>
            <h2 className="vehicle-section__title">Oprema</h2>
            <div className="modal__features">
              {car.features.map((f) => (
                <span className="modal__chip" key={f}>
                  {f}
                </span>
              ))}
            </div>
          </section>
          <section>
            <h2 className="vehicle-section__title">Uslovi najma</h2>
            <dl className="vehicle-terms">
              {terms.map(([label, value]) => (
                <div className="vehicle-terms__row" key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <section className="vehicle-section">
          <h2 className="vehicle-section__title">Slična vozila</h2>
          <ul className="fleet__grid vehicle-similar">
            {similar.map((c, i) => (
              <FleetCard
                key={c.id}
                car={c}
                index={i}
                total={similar.length}
                dates={{ pickup, ret, days }}
                onReserve={openReservation}
              />
            ))}
          </ul>
        </section>
      </div>

      {reservationCar && (
        <ReservationModal
          car={reservationCar}
          onClose={closeReservation}
          triggerRef={triggerRef}
          initialPickup={pickup}
          initialReturn={ret}
        />
      )}
    </div>
  );
}
