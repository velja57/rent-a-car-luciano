import { fleet } from '../../data/fleet';
import { EXTRAS } from '../../data/rental';
import sr from '../../i18n/sr';

// Statusi rezervacije (isti kao u supabase/schema.sql).
export const STATUSES = {
  confirmed: 'Potvrđena',
  picked_up: 'Aktivna — vozilo preuzeto',
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
      confirm: 'Kupac pri preuzimanju plaća ceo iznos rezervacije.',
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
      action: 'return',
      label: 'Vozilo vraćeno',
      confirm: 'Označiti da je kupac vratio vozilo? Rezervacija postaje „Završena“, a vozilo je ponovo dostupno.',
    },
    {
      to: 'confirmed',
      action: 'undo_pickup',
      label: 'Poništi preuzimanje',
      confirm: 'Poništiti preuzimanje? Rezervacija se vraća u „Potvrđena“, a naplata se poništava (ostaje zapisana u istoriji). Koristi samo ako je „Vozilo preuzeto“ kliknuto greškom.',
      danger: true,
    },
  ],
  cancelled: [
    {
      to: 'confirmed',
      label: 'Ponovo aktiviraj',
      confirm: 'Ponovo aktivirati otkazanu rezervaciju? Biće odbijeno ako je termin u međuvremenu zauzet.',
    },
  ],
  no_show: [
    {
      to: 'confirmed',
      label: 'Vrati u potvrđenu',
      confirm:
        'Vratiti rezervaciju u „Potvrđena“? Koristi ako je „Nije se pojavio“ kliknuto greškom. Biće odbijeno ako je termin u međuvremenu zauzet.',
    },
  ],
};

// Statusi koji zauzimaju termin (isto kao u bazi).
export const ACTIVE_STATUSES = ['confirmed', 'picked_up', 'completed'];

export const SOURCES = { web: 'Sa sajta', admin: 'Uneta u adminu' };

export const MONTHS = sr.calendar.months;
export const WEEKDAYS = sr.calendar.weekdays;

export const LANGUAGES = { sr: 'Srpski', en: 'Engleski' };

export const DEFAULT_LOCATION = sr.reservation.defaultLocation;

// Vozila iz src/data/fleet.js: po nazivu (padajući meniji) i redosledom kao na sajtu (kalendar, vozila).
export const VEHICLES = [...fleet].sort((a, b) => a.name.localeCompare(b.name, 'sr'));
export const FLEET_ORDER = fleet;

export function vehicleById(id) {
  return fleet.find((car) => car.id === id) ?? null;
}

// Dodaci sa trenutnim cenama (cene stižu iz baze — src/lib/priceList.js).
export function extraOptions() {
  return EXTRAS.map((extra) => ({ ...extra, name: sr.extras[extra.id] ?? extra.id }));
}

export function extraName(id) {
  return sr.extras[id] ?? id;
}

// Poreklo cene rezervacije (kolona price_source).
export const PRICE_SOURCES = {
  price_list: 'po cenovniku',
  admin: 'uneo admin',
  reconstructed: 'iz obračuna sa sajta',
};

// Ručno beleženje novca (tabela payments). Kaucija nije prihod.
export const PAYMENT_KINDS = {
  payment: 'Uplata',
  refund: 'Povraćaj kupcu',
  deposit_received: 'Kaucija primljena',
  deposit_returned: 'Kaucija vraćena',
};

export const PAYMENT_METHODS = { cash: 'Gotovina', card: 'Kartica', bank: 'Uplata na račun', other: 'Drugo' };

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
  picked_up_at: 'Preuzeto',
  returned_at: 'Vraćeno',
  paid_at: 'Datum uplate',
  return_date: 'Datum vraćanja',
  pickup_time: 'Vreme preuzimanja',
  return_time: 'Vreme vraćanja',
  pickup_location: 'Lokacija preuzimanja',
  return_location: 'Lokacija vraćanja',
  note: 'Napomena',
  language: 'Jezik',
  total_price: 'Iznos',
  extras: 'Dodaci',
  price_summary: 'Obračun sa sajta',
  source: 'Izvor',
  list_price: 'Cena iz cenovnika',
  discount_percent: 'Popust (%)',
  daily_rate: 'Cena po danu',
  rental_days: 'Broj dana',
  rental_total: 'Najam',
  extras_total: 'Dodaci (iznos)',
  price_source: 'Poreklo cene',
};

// Polja istorije promena koja su iznosi u evrima.
export const MONEY_FIELDS = ['total_price', 'list_price', 'daily_rate', 'rental_total', 'extras_total'];

export const EVENT_LABELS = {
  created: 'Rezervacija napravljena',
  updated: 'Izmenjeni podaci',
  status_changed: 'Promenjen status',
  payment_added: 'Zabeležena uplata',
  payment_voided: 'Poništena uplata',
  payment_date_aligned: 'Datum uplate usklađen sa datumom preuzimanja',
};

export function actorLabel(actor) {
  if (actor === 'sajt') return 'kupac preko sajta';
  if (actor === 'sistem') return 'sistem';
  if (actor === 'sql') return 'SQL Editor';
  return actor || 'nepoznato';
}
