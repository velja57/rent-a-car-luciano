import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useI18n } from '../i18n';
import { billableDays, defaultPickupTime, defaultReturnTime, pickupSlots, returnSlots, TIME_SLOTS } from '../lib/rentalTimes';
import { useAvailability } from '../lib/useAvailability';
import { ALL_CAR_IDS, useFleetFilters } from '../lib/useFleetFilters';
import { useRentalDates } from '../lib/useRentalDates';
import DateRangeFields from './DateRangeFields';
import FleetCard from './FleetCard';
import FleetFilters from './FleetFilters';
import ReservationModal from './ReservationModal';
import './Fleet.css';
import '../pages/FleetPage.css';
import './HeroSearch.css';

// Na desktopu i telefonu se prvo vide 3 vozila, na tabletu (2 u redu) 4 — vidi HeroSearch.css.
const PREVIEW_COUNT = 3;
const PREVIEW_RENDERED = 4;

function TimeField({ label, ariaLabel, value, options, disabled, onChange }) {
  return (
    <label className="date-range__field hero-search__time">
      <span className="date-range__label">{label}</span>
      <select value={value} disabled={disabled || options.length === 0} aria-label={ariaLabel} onChange={onChange}>
        {options.length === 0 && <option value="">—</option>}
        {options.map((time) => (
          <option key={time} value={time}>
            {time}
          </option>
        ))}
      </select>
    </label>
  );
}

// Početna: pretraga vozila po terminu, filteri, sortiranje i kartice — zajednička
// logika sa stranicom /vozila (useFleetFilters, FleetFilters, FleetCard). Sve je u
// adresi, pa izbor ostaje posle povratka sa stranice vozila i promene jezika.
export default function Hero() {
  const { t } = useI18n();
  const h = t.hero;
  const f = t.fleetPage;
  const r = t.reservation;
  const [params, setParams] = useSearchParams();
  const { pickup, ret, setDates } = useRentalDates();

  const pickupParam = params.get('vreme-od') ?? '';
  const returnParam = params.get('vreme-do') ?? '';
  const pickupOptions = pickup ? pickupSlots(pickup, []) : TIME_SLOTS;
  const pickupTime = pickupOptions.includes(pickupParam) ? pickupParam : defaultPickupTime(pickupOptions);
  const returnOptions = pickup && ret ? returnSlots(pickup, pickupTime, ret, []) : TIME_SLOTS;
  const returnTime = returnOptions.includes(returnParam) ? returnParam : defaultReturnTime(returnOptions, pickupTime);
  const days = billableDays(pickup, pickupTime, ret, returnTime);

  // Posle nove rezervacije dostupnost se proverava ponovo.
  const [bookings, setBookings] = useState(0);
  const onBooked = useCallback(() => setBookings((n) => n + 1), []);
  const availability = useAvailability(ALL_CAR_IDS, pickup, ret, pickupTime, returnTime, bookings);
  const filters = useFleetFilters(availability, { hideBusy: true });
  const { availabilityReady, setParam, resetFilters, visible, filtersActive } = filters;

  const showAll = params.get('sva') === '1';
  const [foundBefore, foundCount, foundAfter] = h.found(visible.length);

  const gridRef = useRef(null);
  const focusNewCards = useRef(false);
  useEffect(() => {
    if (!showAll || !focusNewCards.current) return;
    focusNewCards.current = false;
    gridRef.current?.children[PREVIEW_COUNT]?.querySelector('a')?.focus({ preventScroll: true });
  }, [showAll]);

  const [reservationCar, setReservationCar] = useState(null);
  // Dugme koje je otvorilo formu — fokus mu se vraća kad se forma zatvori.
  const triggerRef = useRef(null);
  const openReservation = (car, trigger) => {
    triggerRef.current = trigger;
    setReservationCar(car);
  };
  const closeReservation = useCallback(() => setReservationCar(null), []);

  const clearDates = () => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        ['od', 'do', 'vreme-od', 'vreme-do'].forEach((key) => next.delete(key));
        return next;
      },
      { replace: true },
    );
  };

  return (
    <section className="fleet hero-search" id="vozila" aria-labelledby="hero-search-title">
      <div className="container">
        <header className="hero-search__head">
          <h1 className="hero-search__title" id="hero-search-title">
            {h.searchTitle[0]}
            <span>{h.searchTitle[1]}</span>
          </h1>
          <p className="hero-search__subtitle">{h.searchSubtitle}</p>
        </header>

        <div className="hero-search__bar" aria-label={f.searchLabel} role="search">
          <DateRangeFields
            pickup={pickup}
            ret={ret}
            onChange={setDates}
            popover
            times={{
              start: (
                <TimeField
                  label={h.time}
                  ariaLabel={r.pickupTime}
                  value={pickupTime}
                  options={pickupOptions}
                  disabled={!pickup}
                  onChange={(e) => setParam('vreme-od', e.target.value)}
                />
              ),
              end: (
                <TimeField
                  label={h.time}
                  ariaLabel={r.returnTime}
                  value={returnTime}
                  options={returnOptions}
                  disabled={!ret}
                  onChange={(e) => setParam('vreme-do', e.target.value)}
                />
              ),
            }}
          />
          <FleetFilters filters={filters} />
        </div>

        <div className="fleet-results" aria-live="polite">
          <p>
            {foundBefore}
            <strong>{foundCount}</strong>
            {foundAfter}
            {availability.status === 'checking' && f.checking}
            {availability.status === 'error' && f.availabilityError}
          </p>
          <div className="fleet-results__actions">
            {(pickup || ret) && (
              <button type="button" className="fleet-search__clear" onClick={clearDates}>
                {f.clearDates}
              </button>
            )}
            {filtersActive && (
              <button type="button" className="fleet-search__clear" onClick={resetFilters}>
                {f.resetFilters}
              </button>
            )}
          </div>
        </div>

        {visible.length > 0 ? (
          <ul ref={gridRef} className={`fleet__grid${showAll ? '' : ' hero-search__grid--preview'}`}>
            {(showAll ? visible : visible.slice(0, PREVIEW_RENDERED)).map((car, i) => (
              <FleetCard
                key={car.id}
                car={car}
                index={i}
                total={visible.length}
                dates={{ pickup, ret, days }}
                availability={availabilityReady ? availability.byId[car.id] : undefined}
                checking={availability.status === 'checking'}
                onReserve={openReservation}
                compact
              />
            ))}
          </ul>
        ) : (
          <div className="fleet-empty">
            <p>{filtersActive ? f.empty : h.noFree}</p>
            <button type="button" className="car-form__more" onClick={filtersActive ? resetFilters : clearDates}>
              {filtersActive ? f.resetFilters : f.clearDates}
            </button>
          </div>
        )}

        {!showAll && visible.length > PREVIEW_COUNT && (
          <div className="hero-search__more" data-count={visible.length}>
            <button
              type="button"
              className="car-form__cta"
              onClick={() => {
                focusNewCards.current = true;
                setParam('sva', '1');
              }}
            >
              {f.showAll}
            </button>
          </div>
        )}
      </div>

      {reservationCar && (
        <ReservationModal
          car={reservationCar}
          onClose={closeReservation}
          onBooked={onBooked}
          triggerRef={triggerRef}
          initialPickup={pickup}
          initialReturn={ret}
          initialPickupTime={pickupTime}
          initialReturnTime={returnTime}
        />
      )}
    </section>
  );
}
