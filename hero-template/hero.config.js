// Sve što se menja za novu agenciju je u ovom fajlu. Tekstovi su u i18n/sr.js i
// i18n/en.js, boje na vrhu hero.css. Podrazumevane vrednosti su one sa sajta
// Luciano Rent a Car, pa template izgleda isto kao original.

// ---------- Agencija ----------
export const BRAND = {
  // Logo kao tekst: "name" belom, "accent" zlatnom bojom.
  name: 'Luciano',
  accent: 'Rent a Car',
  // Logo kao slika: upiši adresu (npr. '/logo.svg') i slika zamenjuje tekst iznad.
  logoImage: null,
  logoAlt: 'Luciano Rent a Car',
  // Prikazuje se kad se "Pozovi nas" klikne na računaru.
  email: 'luciano@gmail.com',
};

// ---------- Kontakt ----------
export const PHONE_DISPLAY = '060 484 8086';
export const PHONE_HREF = 'tel:+381604848086';
// Broj za WhatsApp u međunarodnom formatu bez '+' i vodeće nule.
export const WHATSAPP_NUMBER = '381604848086';

// Radno vreme za oznaku "Sada smo dostupni" uz dugme za poziv.
export const WORKING_HOURS = { weekdays: [1, 2, 3, 4, 5], from: 8, to: 16, timeZone: 'Europe/Belgrade' };

// ---------- Jezici i linkovi ----------
// Ako ostane samo jedan jezik, prekidač jezika se ne prikazuje.
export const LANGUAGES = [
  { id: 'sr', label: 'SR', name: 'Srpski' },
  { id: 'en', label: 'EN', name: 'English' },
];
export const DEFAULT_LANGUAGE = 'sr';

// Adrese na koje vode linkovi, po jeziku.
export const PATHS = {
  sr: {
    home: '/',
    fleet: '/vozila',
    whyUs: '/#zasto-mi',
    terms: '/uslovi-najma',
    contact: '#kontakt',
    privacy: '/politika-privatnosti',
  },
  en: {
    home: '/en',
    fleet: '/en/vehicles',
    whyUs: '/en#zasto-mi',
    terms: '/en/rental-terms',
    contact: '#kontakt',
    privacy: '/en/privacy-policy',
  },
};

// Stavke glavnog menija, redom. Natpisi su u i18n (nav), adrese u PATHS iznad.
export const NAV_LINKS = ['home', 'fleet', 'whyUs', 'terms', 'contact'];

// Broj u linku "Pogledaj svih 12 vozila u floti →".
export const FLEET_COUNT = 12;

// ---------- Vozila ----------
// framesDir: adresa foldera sa slikama 0000.jpg, 0001.jpg, ...
// frameCount: koliko ih ima. Za običnu fotografiju bez animacije: jedna slika
// 0000.jpg i frameCount: 1. comingSoon: true = vidi se u listi, ali ne može da se izabere.
// Cene i podaci o Golfu i Audiju su sa sajta Luciano.
export const cars = [
  {
    id: 'golf',
    name: 'Volkswagen Golf 8',
    category: 'Kompakt',
    transmission: 'Automatik',
    fuel: 'Dizel',
    seats: 5,
    pricePerDay: 55,
    framesDir: '/frames/golf',
    frameCount: 49,
    year: 2024,
    doors: 5,
    luggage: '2 velika kofera',
    mileage: 'Neograničena kilometraža',
    minAge: 18,
    deposit: null,
    cancellation: 'Besplatno otkazivanje do 48h pre preuzimanja',
    description:
      'Kompaktan hečbek najnovije generacije (2024), potpuno opremljen. Tih dizel motor i automatski menjač čine vožnju opuštenom u svakoj prilici.',
    en: {
      description:
        'A latest-generation (2024) compact hatchback, fully equipped. A quiet diesel engine and an automatic gearbox make every drive relaxed.',
    },
    features: [
      'Osiguranje uključeno',
      'Klima uređaj',
      'Navigacija',
      'Bluetooth',
      'Tempomat',
      'Senzori za parkiranje',
      'Android Auto / CarPlay',
      'Kamera za vožnju unazad',
      'Grejanje sedišta',
    ],
  },
  {
    id: 'audi',
    name: 'Audi A5 Sportback',
    category: 'Limuzina',
    transmission: 'Automatik',
    fuel: 'Dizel',
    seats: 5,
    pricePerDay: 60,
    framesDir: '/frames/audi',
    frameCount: 49,
    year: 2022,
    doors: 5,
    luggage: '3 velika kofera',
    mileage: 'Neograničena kilometraža',
    minAge: 18,
    deposit: 300,
    cancellation: 'Besplatno otkazivanje do 48h pre preuzimanja',
    description:
      'Premium sportski liftback, godište 2022, potpuno opremljen. Snažan motor i automatski menjač za maksimalnu udobnost na svakom putu.',
    en: {
      description:
        'A premium sporty liftback from 2022, fully equipped. A powerful engine and an automatic gearbox for maximum comfort on every trip.',
    },
    features: [
      'Osiguranje uključeno',
      'Klima uređaj',
      'Kožna sedišta',
      'Navigacija',
      'Bluetooth',
      'Tempomat',
      'Senzori za parkiranje',
      'Android Auto / CarPlay',
      'Kamera za vožnju unazad',
      'Grejanje sedišta',
    ],
  },
  {
    id: 'bmw',
    name: 'BMW M5',
    category: 'Sportska limuzina',
    comingSoon: true,
  },
  {
    id: 'merc',
    name: 'Mercedes-Benz C 300',
    category: 'Limuzina',
    comingSoon: true,
  },
];

// ---------- Cene i pravila najma ----------
// Popust po dužini najma, u odnosu na osnovnu cenu (pricePerDay).
export const DISCOUNT_TIERS = [
  { minDays: 1, discount: 0 },
  { minDays: 3, discount: 0.1 },
  { minDays: 7, discount: 0.15 },
  { minDays: 14, discount: 0.2 },
  { minDays: 30, discount: 0.3 },
];

// Najduži najam koji kupac može da rezerviše preko forme.
export const MAX_ONLINE_DAYS = 30;

// Preuzimanje i vraćanje preko forme: radnim danima od 8 do 20 h, na pola sata.
export const RENTAL_HOURS = {
  weekdays: [1, 2, 3, 4, 5],
  from: '08:00',
  to: '20:00',
  stepMinutes: 30,
  graceMinutes: 59,
  bufferMinutes: 120,
};

// Cene u dinarima su informativne, osnovna valuta je evro.
export const EUR_TO_RSD = 117.2;

// Dodatne usluge u formi. per: 'day' = po danu, 'rental' = jednom po najmu. Natpisi su u i18n (extras).
export const EXTRAS = [
  { id: 'child-seat', price: 0, per: 'day' },
  { id: 'full-cover', price: 8, per: 'day' },
  { id: 'airport', price: 0, per: 'rental' },
  { id: 'cross-border', price: 30, per: 'rental' },
];
