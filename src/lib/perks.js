import { fleet } from '../data/fleet';
import { EXTRAS } from '../data/rental';
import { MAX_DISCOUNT_PERCENT } from './pricing';

// Podaci za pogodnosti na početnoj (traka ispod hero-a, "Zašto Luciano", aerodrom).
// Cene dodataka stižu iz cenovnika u bazi (admin), pa se "besplatno" prikazuje
// samo kad je cena zaista 0 € — sajt nikad ne obećava ono što forma naplaćuje.
export function perkFacts() {
  const price = (id) => EXTRAS.find((extra) => extra.id === id)?.price ?? null;
  return {
    airportPrice: price('airport'),
    airportFree: price('airport') === 0,
    childSeatFree: price('child-seat') === 0,
    noDeposit: fleet.filter((car) => !car.deposit).length,
    total: fleet.length,
    maxDiscount: MAX_DISCOUNT_PERCENT,
  };
}
