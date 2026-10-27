// Uslovi najma i cenovna politika — zajedničko za SVA vozila (hero i flota).
// Sve vrednosti su PREDLOG dok klijent ne pošalje svoje uslove; menjaju se
// samo ovde, ostatak sajta (kartice, stranice vozila, forma za rezervaciju)
// računa iz ovih podataka.

export const PHONE_DISPLAY = '060 484 8086';
export const PHONE_HREF = 'tel:+381604848086';
// Broj za WhatsApp u međunarodnom formatu bez '+' i vodeće nule.
export const WHATSAPP_NUMBER = '381604848086';

// Popust po dužini najma, u odnosu na osnovnu cenu (pricePerDay = 1–2 dana).
export const DISCOUNT_TIERS = [
  { minDays: 1, discount: 0, label: '1–2 dana' },
  { minDays: 3, discount: 0.1, label: '3–6 dana' },
  { minDays: 7, discount: 0.15, label: '7–13 dana' },
  { minDays: 14, discount: 0.2, label: '14–29 dana' },
  { minDays: 30, discount: 0.3, label: '30+ dana' },
];

// Okvirni srednji kurs NBS — ažuriraj povremeno. Cene u dinarima su informativne,
// osnovna valuta je evro.
export const EUR_TO_RSD = 117.2;

// Dodatne usluge u formi za rezervaciju. per: 'day' = po danu, 'rental' = jednom po najmu.
export const EXTRAS = [
  { id: 'additional-driver', label: 'Dodatni vozač', price: 0, per: 'rental' },
  { id: 'child-seat', label: 'Dečije sedište', price: 3, per: 'day' },
  { id: 'full-cover', label: 'Puno kasko (bez učešća u šteti)', price: 8, per: 'day' },
  { id: 'airport', label: 'Preuzimanje ili vraćanje na aerodromu', price: 15, per: 'rental' },
  { id: 'cross-border', label: 'Izlazak iz Srbije (zeleni karton)', price: 30, per: 'rental' },
];

// Šta je uključeno u svaku cenu.
export const INCLUDED = [
  'Osnovno osiguranje',
  'Neograničena kilometraža',
  'Besplatno otkazivanje do 48h',
  'Dodatni vozač bez doplate',
  'Bez skrivenih troškova',
];
