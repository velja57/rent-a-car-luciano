import { useCallback, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import CallNotice from '../components/CallNotice';
import DateRangeFields from '../components/DateRangeFields';
import DiscountLadder from '../components/DiscountLadder';
import FleetCard from '../components/FleetCard';
import ReservationModal from '../components/ReservationModal';
import ResponseTime from '../components/ResponseTime';
import VehicleGallery from '../components/VehicleGallery';
import { fleet } from '../data/fleet';
import { PHONE_DISPLAY, PHONE_HREF } from '../data/rental';
import { useI18n } from '../i18n';
import { bookingMessage, whatsappUrl } from '../lib/contact';
import { useCallNotice } from '../lib/useCallNotice';
import { formatEur, formatNumber, formatRsd, lowestRate, MAX_DISCOUNT_PERCENT, quote, tierLabel } from '../lib/pricing';
import { useAvailability } from '../lib/useAvailability';
import { useBookedDates } from '../lib/useBookedDates';
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
  return <VehicleDetails key={car.id} rawCar={car} />;
}

function VehicleDetails({ rawCar }) {
  const { lang, t, paths, localize } = useI18n();
  const v = t.vehiclePage;
  const car = localize(rawCar);
  usePageMeta(t.meta.vehicleTitle(car.name), t.meta.vehicleDescription(car, formatEur(lowestRate(car), lang)));
  const { showCallNotice, handleCallClick, handleMouseLeave } = useCallNotice();

  const { pickup, ret, days, setDates } = useRentalDates();
  // Posle nove rezervacije dostupnost i zauzeti dani u kalendaru se učitavaju ponovo.
  const [bookings, setBookings] = useState(0);
  const onBooked = useCallback(() => setBookings((n) => n + 1), []);
  const availability = useAvailability([car.id], pickup, ret, '', '', bookings);
  const bookedRanges = useBookedDates(car.id, bookings);
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
  const similar = similarCars(rawCar);
  const depositText = car.deposit ? formatEur(car.deposit, lang) : t.common.noDeposit;

  const specs = [
    [t.specs.engine, car.engine],
    [t.specs.power, `${car.power} ${t.powerUnit}`],
    [t.specs.transmission, car.transmission],
    [t.specs.fuel, car.fuel],
    [t.specs.drive, car.drive],
    [t.specs.consumption, car.consumption],
    [t.specs.seats, car.seats],
    [t.specs.doors, car.doors],
    [t.specs.trunk, `${formatNumber(car.trunk, lang)} L`],
    [t.specs.luggage, car.luggage],
  ];

  const terms = [
    [t.specs.mileage, car.mileage],
    [t.specs.deposit, depositText],
    [t.specs.minDriverAge, t.common.minAge(car.minAge)],
    [t.specs.cancellation, car.cancellation],
  ];

  return (
    <div className="vehicle-page">
      <div className="fleet__bg" aria-hidden="true" />

      <div className="container vehicle-page__inner">
        <nav className="vehicle-page__crumbs" aria-label={v.crumbsLabel}>
          <Link to={paths.home}>{t.nav.home}</Link>
          <span aria-hidden="true">/</span>
          <Link to={`${paths.fleet}${datesQuery(pickup, ret)}`}>{t.nav.fleet}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{car.name}</span>
        </nav>

        <div className="vehicle-page__top">
          <VehicleGallery car={car} />

          <aside className="vehicle-panel" aria-labelledby="vehicle-title">
            <span className="modal__eyebrow">
              {car.category} · {t.year(car.year)}
            </span>
            <h1 className="vehicle-panel__title" id="vehicle-title">
              {car.name}
            </h1>
            <p className="vehicle-panel__engine">
              {car.engine} · {car.power} {t.powerUnit} · {car.transmission} · {car.fuel}
            </p>
            <div className="vehicle-panel__badges">
              {car.recommended && <span className="vehicle-badge vehicle-badge--gold">{t.common.recommended}</span>}
              <span className={`vehicle-badge${car.deposit ? '' : ' vehicle-badge--ok'}`}>
                {car.deposit ? t.common.deposit(depositText) : `✓ ${t.common.noDeposit}`}
              </span>
              <span className="vehicle-badge">{t.common.unlimitedMileage}</span>
            </div>

            <div className="vehicle-panel__price">
              {period ? (
                <>
                  <span className="vehicle-panel__price-label">{v.totalFor(days, t.days(days))}</span>
                  <span className="vehicle-panel__price-main">
                    <strong>{formatEur(period.total, lang)}</strong>
                    {period.savings > 0 && <s>{formatEur(car.pricePerDay * days, lang)}</s>}
                  </span>
                  <span className="vehicle-panel__price-sub">
                    {v.perDayRsd(formatEur(period.rate, lang), formatRsd(period.total, lang))}
                    {period.savings > 0 && v.savings(formatEur(period.savings, lang))}
                  </span>
                </>
              ) : (
                <>
                  <span className="vehicle-panel__price-label">{t.card.from}</span>
                  <span className="vehicle-panel__price-main">
                    <strong>{formatEur(lowestRate(car), lang)}</strong>
                    <span>{t.common.perDay}</span>
                  </span>
                  <span className="vehicle-panel__price-sub">
                    {v.baseInfo(
                      formatEur(car.pricePerDay, lang),
                      tierLabel(0, t.days),
                      formatRsd(car.pricePerDay, lang),
                      MAX_DISCOUNT_PERCENT,
                    )}
                  </span>
                </>
              )}
            </div>

            <DateRangeFields pickup={pickup} ret={ret} onChange={setDates} booked={bookedRanges} />

            {days > 0 && availability.status !== 'idle' && (
              <p
                className={`vehicle-panel__availability vehicle-panel__availability--${unavailable ? 'busy' : availability.status}`}
                aria-live="polite"
              >
                {availability.status === 'checking' && v.checking}
                {availability.status === 'ready' && !unavailable && v.available}
                {unavailable && v.busy}
                {availability.status === 'error' && v.error}
              </p>
            )}

            <button
              type="button"
              className="car-form__cta vehicle-panel__cta"
              disabled={unavailable}
              onClick={(e) => openReservation(rawCar, e.currentTarget)}
            >
              {period ? v.reserveFor(formatEur(period.total, lang)) : t.common.reserveNow}
            </button>
            <div className="vehicle-panel__quick" onMouseLeave={handleMouseLeave}>
              <span className="vehicle-panel__quick-label">{v.quick}</span>
              <div className="vehicle-panel__quick-actions">
                <a
                  className="vehicle-quick vehicle-quick--whatsapp"
                  href={whatsappUrl(bookingMessage({ t, lang, car, pickup, ret }))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.common.whatsapp}
                </a>
                <a className="vehicle-quick" href={PHONE_HREF} onClick={handleCallClick}>
                  {t.common.callShort} {PHONE_DISPLAY}
                </a>
              </div>
              {showCallNotice && <CallNotice />}
              <ResponseTime className="response-time--center" />
            </div>

            <ul className="vehicle-panel__included">
              {t.included.map((item) => (
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
          <h2 className="vehicle-section__title">{v.about}</h2>
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
          <h2 className="vehicle-section__title">{v.pricing}</h2>
          <p className="vehicle-section__lead">{v.pricingLead}</p>
          <DiscountLadder days={days} car={car} />
        </section>

        <div className="vehicle-section vehicle-section--split">
          <section>
            <h2 className="vehicle-section__title">{v.equipment}</h2>
            <div className="modal__features">
              {car.features.map((feature) => (
                <span className="modal__chip" key={feature}>
                  {feature}
                </span>
              ))}
            </div>
          </section>
          <section>
            <h2 className="vehicle-section__title">{v.terms}</h2>
            <dl className="vehicle-terms">
              {terms.map(([label, value]) => (
                <div className="vehicle-terms__row" key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <Link className="vehicle-terms__more" to={paths.terms}>
              {v.allTerms} →
            </Link>
          </section>
        </div>

        <section className="vehicle-section">
          <h2 className="vehicle-section__title">{v.similar}</h2>
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
          onBooked={onBooked}
          triggerRef={triggerRef}
          initialPickup={pickup}
          initialReturn={ret}
        />
      )}
    </div>
  );
}
