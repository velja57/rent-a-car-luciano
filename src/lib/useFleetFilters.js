import { useSearchParams } from 'react-router';
import { fleet, fuelKind } from '../data/fleet';

// Vrednosti filtera u adresi su iste na oba jezika (?menjac=automatik…), nazivi su u rečnicima.
export const TRANSMISSIONS = ['automatik', 'manuelni'];
export const FUELS = ['dizel', 'benzin', 'hibrid'];

export const SORTS = [
  { id: 'cena', compare: (a, b) => a.pricePerDay - b.pricePerDay },
  { id: 'cena-opadajuce', compare: (a, b) => b.pricePerDay - a.pricePerDay },
  { id: 'snaga', compare: (a, b) => b.power - a.power },
  {
    id: 'preporuka',
    compare: (a, b) => Number(Boolean(b.recommended)) - Number(Boolean(a.recommended)) || a.pricePerDay - b.pricePerDay,
  },
];

const FILTER_KEYS = ['tip', 'menjac', 'gorivo', 'slobodna'];

export const ALL_CAR_IDS = fleet.map((c) => c.id);

// Filteri i sortiranje flote (stanje je u adresi) — isto na stranici /vozila i u
// Hero sekciji. availability: rezultat useAvailability. hideBusy: zauzeta vozila
// se uvek sklanjaju, bez obzira na "Samo slobodna".
export function useFleetFilters(availability, { hideBusy = false } = {}) {
  const [params, setParams] = useSearchParams();

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
    .filter((car) => !((onlyFree || hideBusy) && availabilityReady) || isFree(car))
    .sort((a, b) => (availabilityReady ? Number(isFree(b)) - Number(isFree(a)) : 0) || sort.compare(a, b));

  return {
    type,
    transmission,
    fuel,
    onlyFree,
    sort,
    availabilityReady,
    setParam,
    resetFilters,
    isFree,
    visible,
    filtersActive: FILTER_KEYS.some((k) => params.has(k)),
  };
}
