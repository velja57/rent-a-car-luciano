import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import DateRangeFields from '../components/DateRangeFields';
import DiscountLadder from '../components/DiscountLadder';
import FleetCard from '../components/FleetCard';
import ReservationModal from '../components/ReservationModal';
import { fleet, fuelKind, VEHICLE_TYPES } from '../data/fleet';
import { DISCOUNT_TIERS, PHONE_DISPLAY, PHONE_HREF } from '../data/rental';
import { useI18n } from '../i18n';
import { whatsappUrl } from '../lib/contact';
import { discountPercent, formatEur, lowestRate, MAX_DISCOUNT_PERCENT, tierFor } from '../lib/pricing';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useAvailability } from '../lib/useAvailability';
import { usePageMeta } from '../lib/usePageMeta';
import { useRentalDates } from '../lib/useRentalDates';
import '../components/Fleet.css';
import './FleetPage.css';

// Vrednosti filtera u adresi su iste na oba jezika (?menjac=automatik…), nazivi su u rečnicima.
const TRANSMISSIONS = ['automatik', 'manuelni'];
const FUELS = ['dizel', 'benzin', 'hibrid'];

const SORTS = [
  { id: 'cena', compare: (a, b) => a.pricePerDay - b.pricePerDay },
  { id: 'cena-opadajuce', compare: (a, b) => b.pricePerDay - a.pricePerDay },
  { id: 'snaga', compare: (a, b) => b.power - a.power },
  {
    id: 'preporuka',
    compare: (a, b) => Number(Boolean(b.recommended)) - Number(Boolean(a.recommended)) || a.pricePerDay - b.pricePerDay,
  },
];

const FILTER_KEYS = ['tip', 'menjac', 'gorivo', 'slobodna'];
const FIRST_DISCOUNT_TIER = DISCOUNT_TIERS.find((tier) => tier.discount > 0);
const allIds = fleet.map((c) => c.id);
const minPrice = Math.min(...fleet.map(lowestRate));

export default function FleetPage() {
  const { lang, t } = useI18n();
  const f = t.fleetPage;
  usePageMeta(t.meta.fleetTitle, t.meta.fleetDescription(fleet.length, formatEur(minPrice, lang), MAX_DISCOUNT_PERCENT));

  const [params, setParams] = useSearchParams();
  const { pickup, ret, days, setDates } = useRentalDates();
  const availability = useAvailability(allIds, pickup, ret);
  const [reservationCar, setReservationCar] = useState(null);
  // Dugme koje je otvorilo formu — fokus mu se vraća kad se forma zatvori.
  const triggerRef = useRef(null);

  const type = params.get('tip') ?? '';
  const transmission = params.get('menjac') ?? '';
  const fuel = params.get('gorivo') ?? '';
  const onlyFree = params.get('slobodna') === '1';
  const sort = SORTS.find((s) => s.id === params.get('sort')) ?? SORTS[0];
  const availabilityReady = availability.status === 'ready';

  const setParam = (key, value) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const resetFilters = () => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        FILTER_KEYS.forEach((k) => next.delete(k));
        return next;
      },
      { replace: true },
    );
  };

  const isFree = (car) => availability.byId[car.id] !== false;

  // Filtriranje radi nad originalnim (srpskim) podacima — prevod je samo za prikaz.
  const visible = fleet
    .filter((car) => !type || car.type === type)
    .filter((car) => !transmission || car.transmission.toLowerCase() === transmission)
    .filter((car) => !fuel || fuelKind(car).toLowerCase() === fuel)
    .filter((car) => !(onlyFree && availabilityReady) || isFree(car))
    .sort((a, b) => (availabilityReady ? Number(isFree(b)) - Number(isFree(a)) : 0) || sort.compare(a, b));

  const filtersActive = FILTER_KEYS.some((k) => params.has(k));
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
                    <span>{f.discountHint(FIRST_DISCOUNT_TIER.minDays, discountPercent(FIRST_DISCOUNT_TIER))}</span>
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

        <div className="fleet-filters" role="group" aria-label={f.filtersLabel}>
          <div className="fleet-filters__chips">
            <button
              type="button"
              className={`fleet-chip${type ? '' : ' fleet-chip--active'}`}
              aria-pressed={!type}
              onClick={() => setParam('tip', '')}
            >
              {f.allTypes}
            </button>
            {VEHICLE_TYPES.map((id) => (
              <button
                type="button"
                key={id}
                className={`fleet-chip${type === id ? ' fleet-chip--active' : ''}`}
                aria-pressed={type === id}
                onClick={() => setParam('tip', type === id ? '' : id)}
              >
                {t.types[id]}
              </button>
            ))}
          </div>

          <div className="fleet-filters__selects">
            <label className="fleet-select">
              <span>{f.transmission}</span>
              <select value={transmission} onChange={(e) => setParam('menjac', e.target.value)}>
                <option value="">{f.allTransmissions}</option>
                {TRANSMISSIONS.map((id) => (
                  <option key={id} value={id}>
                    {f.transmissions[id]}
                  </option>
                ))}
              </select>
            </label>
            <label className="fleet-select">
              <span>{f.fuel}</span>
              <select value={fuel} onChange={(e) => setParam('gorivo', e.target.value)}>
                <option value="">{f.allFuels}</option>
                {FUELS.map((id) => (
                  <option key={id} value={id}>
                    {f.fuels[id]}
                  </option>
                ))}
              </select>
            </label>
            <label className="fleet-select">
              <span>{f.sort}</span>
              <select value={sort.id} onChange={(e) => setParam('sort', e.target.value === SORTS[0].id ? '' : e.target.value)}>
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {f.sorts[s.id]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

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

        <section className="fleet-help">
          <div>
            <h2 className="fleet-help__title">{f.helpTitle}</h2>
            <p className="fleet-help__text">{f.helpText}</p>
          </div>
          <div className="fleet-help__actions">
            <a className="car-form__cta" href={PHONE_HREF}>
              {t.common.call(PHONE_DISPLAY)}
            </a>
            <a className="car-form__more" href={whatsappUrl(f.helpMessage)} target="_blank" rel="noopener noreferrer">
              {f.whatsappMessage}
            </a>
          </div>
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
