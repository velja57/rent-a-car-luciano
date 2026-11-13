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

// Popust za stalne klijente (od trećeg najma), dodatno na popust za duži najam.
// Sajt ne zna ko je stalni klijent, pa se obračunava pri preuzimanju vozila.
export const LOYALTY_DISCOUNT_PERCENT = 10;

// Najduži najam koji kupac može da rezerviše preko sajta (duži se dogovara
// telefonom). Isto ograničenje proverava i baza (create_reservation).
export const MAX_ONLINE_DAYS = 30;

// Preuzimanje i vraćanje preko sajta: radnim danima (pon–pet) od 8 do 20 h, na
// pola sata; drugi termini se dogovaraju telefonom. Ista pravila primenjuje baza
// (supabase/schema.sql): dan najma je 24 h od preuzimanja, vraćanje do 59 min
// kasnije se ne računa, a između dva najma istog vozila su 2 h za pripremu.
export const RENTAL_HOURS = {
  weekdays: [1, 2, 3, 4, 5],
  from: '08:00',
  to: '20:00',
  stepMinutes: 30,
  graceMinutes: 59,
  bufferMinutes: 120,
};

// Okvirni srednji kurs NBS — ažuriraj povremeno. Cene u dinarima su informativne,
// osnovna valuta je evro.
export const EUR_TO_RSD = 117.2;

// Dodatne usluge u formi za rezervaciju. per: 'day' = po danu, 'rental' = jednom po najmu.
// Cene su početne vrednosti — prave stižu iz cenovnika u bazi (admin → Vozni park →
// Cenovnik). Dečije sedište i dostava na aerodrom su besplatni (cena 0 €). Puno kasko
// ima cenu po vozilu (fleet.js, fullCoverPrice); 8 € ovde važi samo za vozilo bez nje.
export const EXTRAS = [
  { id: 'child-seat', price: 0, per: 'day' },
  { id: 'full-cover', price: 8, per: 'day' },
  { id: 'airport', price: 0, per: 'rental' },
  { id: 'cross-border', price: 30, per: 'rental' },
];
