import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import DateRangeFields from '../components/DateRangeFields';
import DiscountLadder from '../components/DiscountLadder';
import FleetCard from '../components/FleetCard';
import ReservationModal from '../components/ReservationModal';
import { fleet, fuelKind, VEHICLE_TYPES } from '../data/fleet';
import { INCLUDED, PHONE_DISPLAY, PHONE_HREF, WHATSAPP_NUMBER } from '../data/rental';
import { formatDays, lowestRate, MAX_DISCOUNT_PERCENT, tierFor } from '../lib/pricing';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useAvailability } from '../lib/useAvailability';
import { usePageMeta } from '../lib/usePageMeta';
import { useRentalDates } from '../lib/useRentalDates';
import '../components/Fleet.css';
import './FleetPage.css';

const TRANSMISSIONS = [
  { id: 'automatik', label: 'Automatik' },
  { id: 'manuelni', label: 'Manuelni' },
];

const FUELS = [
  { id: 'dizel', label: 'Dizel' },
  { id: 'benzin', label: 'Benzin' },
  { id: 'hibrid', label: 'Hibrid' },
];

const SORTS = [
  { id: 'cena', label: 'Najniža cena', compare: (a, b) => a.pricePerDay - b.pricePerDay },
  { id: 'cena-opadajuce', label: 'Najviša cena', compare: (a, b) => b.pricePerDay - a.pricePerDay },
  { id: 'snaga', label: 'Najveća snaga', compare: (a, b) => b.power - a.power },
  {
    id: 'preporuka',
    label: 'Preporučeno',
    compare: (a, b) => Number(Boolean(b.recommended)) - Number(Boolean(a.recommended)) || a.pricePerDay - b.pricePerDay,
  },
];

const FILTER_KEYS = ['tip', 'menjac', 'gorivo', 'slobodna'];
const allIds = fleet.map((c) => c.id);
const minPrice = Math.min(...fleet.map(lowestRate));

export default function FleetPage() {
  usePageMeta(
    'Vozila — Luciano Rent a Car',
    `Rent a car Beograd: ${fleet.length} vozila od ${minPrice}€ po danu. Gradski automobili, limuzine, SUV, premium i kombi 8+1. Do −${MAX_DISCOUNT_PERCENT}% za duži najam.`,
  );

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

  const visible = fleet
    .filter((car) => !type || car.type === type)
    .filter((car) => !transmission || car.transmission.toLowerCase() === transmission)
    .filter((car) => !fuel || fuelKind(car).toLowerCase() === fuel)
    .filter((car) => !(onlyFree && availabilityReady) || isFree(car))
    .sort((a, b) => (availabilityReady ? Number(isFree(b)) - Number(isFree(a)) : 0) || sort.compare(a, b));

  const filtersActive = FILTER_KEYS.some((k) => params.has(k));
  const freeCount = availabilityReady ? fleet.filter(isFree).length : null;

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
            Flota · {fleet.length} vozila
          </span>
          <h1 className="fleet__title">
            Izaberi vozilo za <span>svoj put</span>
          </h1>
          <p className="fleet__subtitle">
            Unesi datume i odmah vidi slobodna vozila i tačnu cenu za ceo period. Osiguranje i neograničena
            kilometraža uključeni su u svaku cenu.
          </p>
        </header>

        <section className="fleet-search" aria-label="Pretraga po datumima">
          <div className="fleet-search__dates">
            <DateRangeFields pickup={pickup} ret={ret} onChange={setDates} />
            <div className="fleet-search__summary" aria-live="polite">
              {days > 0 ? (
                <>
                  <strong>
                    {days} {formatDays(days)}
                  </strong>
                  {tierFor(days).discount > 0 ? (
                    <span className="fleet-search__badge">
                      Popust −{Math.round(tierFor(days).discount * 100)}% je uračunat
                    </span>
                  ) : (
                    <span>Za 3+ dana dobijaš popust od 10%</span>
                  )}
                </>
              ) : (
                <span>Izaberi datume preuzimanja i vraćanja</span>
              )}
              {(pickup || ret) && (
                <button type="button" className="fleet-search__clear" onClick={() => setDates({ pickup: '', ret: '' })}>
                  Obriši datume
                </button>
              )}
            </div>
          </div>
          <div className="fleet-search__ladder">
            <p className="fleet-search__ladder-title">
              Što duže voziš, manje plaćaš — <strong>do −{MAX_DISCOUNT_PERCENT}%</strong>
            </p>
            <DiscountLadder days={days} />
          </div>
        </section>

        <div className="fleet-filters" role="group" aria-label="Filteri vozila">
          <div className="fleet-filters__chips">
            <button
              type="button"
              className={`fleet-chip${type ? '' : ' fleet-chip--active'}`}
              aria-pressed={!type}
              onClick={() => setParam('tip', '')}
            >
              Sva vozila
            </button>
            {VEHICLE_TYPES.map((t) => (
              <button
                type="button"
                key={t.id}
                className={`fleet-chip${type === t.id ? ' fleet-chip--active' : ''}`}
                aria-pressed={type === t.id}
                onClick={() => setParam('tip', type === t.id ? '' : t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="fleet-filters__selects">
            <label className="fleet-select">
              <span>Menjač</span>
              <select value={transmission} onChange={(e) => setParam('menjac', e.target.value)}>
                <option value="">Svi</option>
                {TRANSMISSIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="fleet-select">
              <span>Gorivo</span>
              <select value={fuel} onChange={(e) => setParam('gorivo', e.target.value)}>
                <option value="">Sva</option>
                {FUELS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="fleet-select">
              <span>Sortiraj</span>
              <select value={sort.id} onChange={(e) => setParam('sort', e.target.value === SORTS[0].id ? '' : e.target.value)}>
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="fleet-results" aria-live="polite">
          <p>
            Prikazano <strong>{visible.length}</strong> od {fleet.length} vozila
            {availability.status === 'checking' && ' · proveravamo dostupnost…'}
            {freeCount !== null && ` · ${freeCount} slobodno za izabrane datume`}
            {availability.status === 'error' && ' · dostupnost trenutno ne možemo da proverimo'}
          </p>
          <div className="fleet-results__actions">
            {isSupabaseConfigured && days > 0 && (
              <label className="fleet-toggle">
                <input
                  type="checkbox"
                  checked={onlyFree}
                  onChange={(e) => setParam('slobodna', e.target.checked ? '1' : '')}
                />
                <span>Samo slobodna</span>
              </label>
            )}
            {filtersActive && (
              <button type="button" className="fleet-search__clear" onClick={resetFilters}>
                Poništi filtere
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
            <p>Nijedno vozilo ne odgovara izabranim filterima.</p>
            <button type="button" className="car-form__more" onClick={resetFilters}>
              Prikaži sva vozila
            </button>
          </div>
        )}

        <section className="fleet-included" aria-labelledby="fleet-included-title">
          <h2 className="fleet-included__title" id="fleet-included-title">
            Uključeno u svaku cenu
          </h2>
          <ul className="fleet-included__list">
            {INCLUDED.map((item) => (
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
            <h2 className="fleet-help__title">Nisi siguran koje vozilo da izabereš?</h2>
            <p className="fleet-help__text">Pozovi nas ili pošalji poruku — pomoći ćemo ti da izabereš najbolje za tvoj put.</p>
          </div>
          <div className="fleet-help__actions">
            <a className="car-form__cta" href={PHONE_HREF}>
              Pozovi {PHONE_DISPLAY}
            </a>
            <a className="car-form__more" href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer">
              WhatsApp poruka
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
