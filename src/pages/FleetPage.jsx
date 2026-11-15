import { useCallback, useRef, useState } from 'react';
import CallNotice from '../components/CallNotice';
import DateRangeFields from '../components/DateRangeFields';
import DiscountLadder from '../components/DiscountLadder';
import FleetCard from '../components/FleetCard';
import FleetFilters from '../components/FleetFilters';
import ReservationModal from '../components/ReservationModal';
import ResponseTime from '../components/ResponseTime';
import { fleet } from '../data/fleet';
import { DISCOUNT_TIERS, PHONE_DISPLAY, PHONE_HREF } from '../data/rental';
import { useI18n } from '../i18n';
import { whatsappUrl } from '../lib/contact';
import { useCallNotice } from '../lib/useCallNotice';
import { discountPercent, formatEur, lowestRate, MAX_DISCOUNT_PERCENT, tierFor } from '../lib/pricing';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useAvailability } from '../lib/useAvailability';
import { ALL_CAR_IDS, useFleetFilters } from '../lib/useFleetFilters';
import { usePageMeta } from '../lib/usePageMeta';
import { useRentalDates } from '../lib/useRentalDates';
import '../components/Fleet.css';
import './FleetPage.css';

export default function FleetPage() {
  const { lang, t } = useI18n();
  const f = t.fleetPage;
  // Računa se pri prikazu — cene i popusti stižu iz baze (src/lib/priceList.js).
  const firstDiscountTier = DISCOUNT_TIERS.find((tier) => tier.discount > 0) ?? DISCOUNT_TIERS[0];
  const minPrice = Math.min(...fleet.map(lowestRate));
  usePageMeta(t.meta.fleetTitle, t.meta.fleetDescription(fleet.length, formatEur(minPrice, lang), MAX_DISCOUNT_PERCENT));
  const { showCallNotice, handleCallClick, handleMouseLeave } = useCallNotice();

  const { pickup, ret, days, setDates } = useRentalDates();
  // Posle nove rezervacije dostupnost se proverava ponovo.
  const [bookings, setBookings] = useState(0);
  const onBooked = useCallback(() => setBookings((n) => n + 1), []);
  const availability = useAvailability(ALL_CAR_IDS, pickup, ret, '', '', bookings);
  const filters = useFleetFilters(availability);
  const { onlyFree, availabilityReady, setParam, resetFilters, isFree, visible, filtersActive } = filters;
  const [reservationCar, setReservationCar] = useState(null);
  // Dugme koje je otvorilo formu — fokus mu se vraća kad se forma zatvori.
  const triggerRef = useRef(null);

  const freeCount = availabilityReady ? fleet.filter(isFree).length : null;
  const [shownBefore, shownCount, shownAfter] = f.shown(visible.length, fleet.length);
  const [ladderText, ladderStrong] = f.ladderTitle(MAX_DISCOUNT_PERCENT);

  const openReservation = (car, trigger) => {
    triggerRef.current = trigger;
    setReservationCar(car);
  };
  const closeReservation = useCallback(() => setReservationCar(null), []);

  return (
    <div className="fleet fleet-page">
      <div className="fleet__bg" aria-hidden="true" />

      <div className="container fleet__inner">
        <header className="fleet__head">
          <span className="fleet__eyebrow">
            <span className="fleet__pulse" />
            {f.eyebrow(fleet.length)}
          </span>
          <h1 className="fleet__title">
            {f.title[0]}
            <span>{f.title[1]}</span>
          </h1>
          <p className="fleet__subtitle">{f.subtitle}</p>
        </header>

        <section className="fleet-search" aria-label={f.searchLabel}>
          <div className="fleet-search__dates">
            <DateRangeFields pickup={pickup} ret={ret} onChange={setDates} />
            <div className="fleet-search__summary" aria-live="polite">
              {days > 0 ? (
                <>
                  <strong>
                    {days} {t.days(days)}
                  </strong>
                  {tierFor(days).discount > 0 ? (
                    <span className="fleet-search__badge">{f.discountApplied(discountPercent(tierFor(days)))}</span>
                  ) : (
                    <span>{f.discountHint(firstDiscountTier.minDays, discountPercent(firstDiscountTier))}</span>
                  )}
                </>
              ) : (
                <span>{f.chooseDates}</span>
              )}
              {(pickup || ret) && (
                <button type="button" className="fleet-search__clear" onClick={() => setDates({ pickup: '', ret: '' })}>
                  {f.clearDates}
                </button>
              )}
            </div>
          </div>
          <div className="fleet-search__ladder">
            <p className="fleet-search__ladder-title">
              {ladderText}
              <strong>{ladderStrong}</strong>
            </p>
            <DiscountLadder days={days} />
          </div>
        </section>

        <FleetFilters filters={filters} />

        <div className="fleet-results" aria-live="polite">
          <p>
            {shownBefore}
            <strong>{shownCount}</strong>
            {shownAfter}
            {availability.status === 'checking' && f.checking}
            {freeCount !== null && f.freeCount(freeCount)}
            {availability.status === 'error' && f.availabilityError}
          </p>
          <div className="fleet-results__actions">
            {isSupabaseConfigured && days > 0 && (
              <label className="fleet-toggle">
                <input
                  type="checkbox"
                  checked={onlyFree}
                  onChange={(e) => setParam('slobodna', e.target.checked ? '1' : '')}
                />
                <span>{f.onlyFree}</span>
              </label>
            )}
            {filtersActive && (
              <button type="button" className="fleet-search__clear" onClick={resetFilters}>
                {f.resetFilters}
              </button>
            )}
          </div>
        </div>

        {visible.length > 0 ? (
          <ul className="fleet__grid">
            {visible.map((car, i) => (
              <FleetCard
                key={car.id}
                car={car}
                index={i}
                total={visible.length}
                dates={{ pickup, ret, days }}
                availability={availabilityReady ? availability.byId[car.id] : undefined}
                checking={availability.status === 'checking'}
                onReserve={openReservation}
              />
            ))}
          </ul>
        ) : (
          <div className="fleet-empty">
            <p>{f.empty}</p>
            <button type="button" className="car-form__more" onClick={resetFilters}>
              {f.showAll}
            </button>
          </div>
        )}

        <section className="fleet-included" aria-labelledby="fleet-included-title">
          <h2 className="fleet-included__title" id="fleet-included-title">
            {f.includedTitle}
          </h2>
          <ul className="fleet-included__list">
            {t.included.map((item) => (
              <li key={item}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="fleet-help" onMouseLeave={handleMouseLeave}>
          <div>
            <h2 className="fleet-help__title">{f.helpTitle}</h2>
            <p className="fleet-help__text">{f.helpText}</p>
            <ResponseTime />
          </div>
          <div className="fleet-help__actions">
            <a className="car-form__cta" href={PHONE_HREF} onClick={handleCallClick}>
              {t.common.call(PHONE_DISPLAY)}
            </a>
            <a className="car-form__more" href={whatsappUrl(f.helpMessage)} target="_blank" rel="noopener noreferrer">
              {f.whatsappMessage}
            </a>
          </div>
          {showCallNotice && <CallNotice />}
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
