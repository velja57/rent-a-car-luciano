// Uslovi najma i cenovna politika — zajedničko za SVA vozila (hero i flota).
// Sve vrednosti su PREDLOG dok klijent ne pošalje svoje uslove; menjaju se
// samo ovde, ostatak sajta (kartice, stranice vozila, forma za rezervaciju)
// računa iz ovih podataka. Nazivi dodataka i spisak "uključeno u cenu" su u
// rečnicima src/i18n/sr.js i en.js (extras, included).

export const PHONE_DISPLAY = '060 484 8086';
export const PHONE_HREF = 'tel:+381604848086';
// Broj za WhatsApp u međunarodnom formatu bez '+' i vodeće nule.
export const WHATSAPP_NUMBER = '381604848086';

// Radno vreme (isto kao u footeru): radnim danima 08–16h, po beogradskom vremenu.
// Koristi se za oznaku "Sada smo dostupni" uz dugme za poziv.
export const WORKING_HOURS = { weekdays: [1, 2, 3, 4, 5], from: 8, to: 16, timeZone: 'Europe/Belgrade' };

// Popust po dužini najma, u odnosu na osnovnu cenu (pricePerDay = 1–2 dana).
export const DISCOUNT_TIERS = [
  { minDays: 1, discount: 0 },
  { minDays: 3, discount: 0.1 },
  { minDays: 7, discount: 0.15 },
  { minDays: 14, discount: 0.2 },
  { minDays: 30, discount: 0.3 },
];

// Okvirni srednji kurs NBS — ažuriraj povremeno. Cene u dinarima su informativne,
// osnovna valuta je evro.
export const EUR_TO_RSD = 117.2;

// Dodatne usluge u formi za rezervaciju. per: 'day' = po danu, 'rental' = jednom po najmu.
export const EXTRAS = [
  { id: 'additional-driver', price: 0, per: 'rental' },
  { id: 'child-seat', price: 3, per: 'day' },
  { id: 'full-cover', price: 8, per: 'day' },
  { id: 'airport', price: 15, per: 'rental' },
  { id: 'cross-border', price: 30, per: 'rental' },
];
