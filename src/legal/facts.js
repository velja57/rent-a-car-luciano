import { COMPANY } from '../data/company';
import { fleet } from '../data/fleet';
import { MAX_ONLINE_DAYS, PHONE_DISPLAY, RENTAL_HOURS } from '../data/rental';

// Činjenice koje uslovi najma i politika privatnosti navode — iz istih podataka
// kao ostatak sajta (flota, pravila najma, kontakt), da tekst uvek odgovara sajtu.
const minAge = Math.min(...fleet.map((car) => car.minAge));

export const FACTS = {
  company: COMPANY,
  phone: PHONE_DISPLAY,
  minAge,
  // Vozila za koja je potrebno više godina od najmanjeg uzrasta: [{ name, minAge }]
  olderDriverCars: fleet.filter((car) => car.minAge > minAge).map((car) => ({ name: car.name, minAge: car.minAge })),
  // Vozila sa depozitom: [{ name, deposit }]
  depositCars: fleet.filter((car) => car.deposit).map((car) => ({ name: car.name, deposit: car.deposit })),
  hoursFrom: RENTAL_HOURS.from.slice(0, 2),
  hoursTo: RENTAL_HOURS.to.slice(0, 2),
  graceMinutes: RENTAL_HOURS.graceMinutes,
  maxOnlineDays: MAX_ONLINE_DAYS,
  freeCancellationHours: 48,
};

// "A, B i C" / "A, B and C"
export function joinList(items, and) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${and} ${items.at(-1)}`;
}

// Firma u jednom redu: naziv (poslovno ime), adresa, PIB i MB — samo ono što je upisano.
export function companyLine(labels, address = COMPANY.address) {
  const c = COMPANY;
  return [
    c.legalName ? `${c.name} (${c.legalName})` : c.name,
    address,
    c.pib && `${labels.pib} ${c.pib}`,
    c.mb && `${labels.mb} ${c.mb}`,
  ]
    .filter(Boolean)
    .join(', ');
}
