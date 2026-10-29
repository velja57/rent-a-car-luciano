import { fleet } from '../../data/fleet';
import { EXTRAS } from '../../data/rental';
import sr from '../../i18n/sr';

// Statusi rezervacije (isti kao u supabase/schema.sql).
export const STATUSES = {
  confirmed: 'Potvrđena',
  picked_up: 'Preuzeta',
  completed: 'Završena',
  cancelled: 'Otkazana',
  no_show: 'Nije se pojavio',
};

export const STATUS_ORDER = ['confirmed', 'picked_up', 'completed', 'cancelled', 'no_show'];

// Dugmad za promenu statusa — isti prelazi kao u admin_set_status (baza ih
// proverava; ovde služe samo da se prikažu odgovarajuća dugmad).
export const TRANSITIONS = {
  confirmed: [
    {
      to: 'picked_up',
      label: 'Vozilo preuzeto',
      confirm: 'Označiti da je kupac preuzeo vozilo?',
    },
    {
      to: 'no_show',
      label: 'Nije se pojavio',
      confirm: 'Označiti da se kupac nije pojavio? Termin se oslobađa za druge rezervacije.',
      danger: true,
    },
    {
      to: 'cancelled',
      label: 'Otkaži rezervaciju',
      confirm: 'Otkazati ovu rezervaciju? Termin se oslobađa za druge rezervacije.',
      danger: true,
    },
  ],
  picked_up: [
    {
      to: 'completed',
      label: 'Vozilo vraćeno',
      confirm: 'Označiti da je vozilo vraćeno? Ako je vraćeno ranije od dogovorenog, prvo izmeni datum vraćanja da se oslobode preostali dani.',
    },
  ],
  cancelled: [
    {
      to: 'confirmed',
      label: 'Ponovo aktiviraj',
      confirm: 'Ponovo aktivirati otkazanu rezervaciju? Biće odbijeno ako je termin u međuvremenu zauzet.',
    },
  ],
};

export const SOURCES = { web: 'Sa sajta', admin: 'Uneta u adminu' };

export const LANGUAGES = { sr: 'Srpski', en: 'Engleski' };

export const DEFAULT_LOCATION = sr.reservation.defaultLocation;

// Vozila iz src/data/fleet.js, po nazivu.
export const VEHICLES = [...fleet].sort((a, b) => a.name.localeCompare(b.name, 'sr'));

export function vehicleById(id) {
  return fleet.find((car) => car.id === id) ?? null;
}

export const EXTRA_OPTIONS = EXTRAS.map((extra) => ({ ...extra, name: sr.extras[extra.id] ?? extra.id }));

export function extraName(id) {
  return sr.extras[id] ?? id;
}

// Nazivi polja u istoriji promena.
export const FIELD_LABELS = {
  status: 'Status',
  car_id: 'Vozilo (oznaka)',
  car_name: 'Vozilo',
  customer_name: 'Kupac',
  email: 'Email',
  phone: 'Telefon',
  date_of_birth: 'Datum rođenja',
  pickup_date: 'Datum preuzimanja',
  return_date: 'Datum vraćanja',
  pickup_time: 'Vreme preuzimanja',
  return_time: 'Vreme vraćanja',
  pickup_location: 'Lokacija preuzimanja',
  return_location: 'Lokacija vraćanja',
  note: 'Napomena',
  language: 'Jezik',
  total_price: 'Iznos',
  extras: 'Dodaci',
  price_summary: 'Procena sa sajta',
  source: 'Izvor',
};

export const EVENT_LABELS = {
  created: 'Rezervacija napravljena',
  updated: 'Izmenjeni podaci',
  status_changed: 'Promenjen status',
  payment_added: 'Zabeležena uplata',
  payment_voided: 'Poništena uplata',
};

export function actorLabel(actor) {
  if (actor === 'sajt') return 'kupac preko sajta';
  if (actor === 'sistem') return 'sistem';
  if (actor === 'sql') return 'SQL Editor';
  return actor || 'nepoznato';
}
