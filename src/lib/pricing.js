import { DISCOUNT_TIERS, EUR_TO_RSD, EXTRAS } from '../data/rental';

const DAY_MS = 86_400_000;
const LOCALES = { sr: 'sr-RS', en: 'en-GB' };

const maxDiscountPercent = () => Math.round(Math.max(...DISCOUNT_TIERS.map((t) => t.discount)) * 100);

// Najveći popust ("do −30%"). Osvežava se kad se cenovnik učita iz baze (src/lib/priceList.js).
export let MAX_DISCOUNT_PERCENT = maxDiscountPercent();

export function refreshPricingConstants() {
  MAX_DISCOUNT_PERCENT = maxDiscountPercent();
}

// Današnji datum (YYYY-MM-DD) po beogradskom vremenu — isto "danas" kao u
// poslovnici i u bazi, bez obzira na vremensku zonu kupca (i posle ponoći).
export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Belgrade' }).format(new Date());
}

// Broj dana najma između dva datuma (YYYY-MM-DD); 0 ako period nije ispravan.
export function rentalDays(pickup, ret) {
  if (!pickup || !ret) return 0;
  const days = Math.round((Date.parse(ret) - Date.parse(pickup)) / DAY_MS);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

export function tierFor(days) {
  return DISCOUNT_TIERS.reduce((found, tier) => (days >= tier.minDays ? tier : found), DISCOUNT_TIERS[0]);
}

export function discountPercent(tier) {
  return Math.round(tier.discount * 100);
}

// "3–6 dana" / "30+ days" — daysWord je t.days iz rečnika.
export function tierLabel(index, daysWord) {
  const tier = DISCOUNT_TIERS[index];
  const next = DISCOUNT_TIERS[index + 1];
  return next ? `${tier.minDays}–${next.minDays - 1} ${daysWord(next.minDays - 1)}` : `${tier.minDays}+ ${daysWord(tier.minDays)}`;
}

// Računa se u celim procentima — isti rezultat kao u bazi (price_quote u supabase/schema.sql).
export function dailyRate(car, days = 1) {
  return Math.round((car.pricePerDay * (100 - discountPercent(tierFor(days)))) / 100);
}

// Najniža dnevna cena (najduži najam) — za prikaz "od X€".
export function lowestRate(car) {
  return dailyRate(car, DISCOUNT_TIERS[DISCOUNT_TIERS.length - 1].minDays);
}

// Cena dodatka za izabrano vozilo: puno kasko ima cenu po vozilu (fullCoverPrice),
// ostali dodaci opštu — isto pravilo kao price_quote u bazi.
export function extraPrice(extra, car) {
  if (extra.id === 'full-cover' && Number.isFinite(car?.fullCoverPrice)) return car.fullCoverPrice;
  return extra.price;
}

export function quote(car, days, extraIds = []) {
  const rate = dailyRate(car, days);
  const rental = rate * days;
  const extras = EXTRAS.filter((e) => extraIds.includes(e.id)).map((e) => {
    const price = extraPrice(e, car);
    return { ...e, price, cost: e.per === 'day' ? price * days : price };
  });
  const extrasTotal = extras.reduce((sum, e) => sum + e.cost, 0);
  return {
    days,
    rate,
    tier: tierFor(days),
    rental,
    savings: car.pricePerDay * days - rental,
    extras,
    extrasTotal,
    total: rental + extrasTotal,
  };
}

export function formatNumber(n, lang = 'sr') {
  return n.toLocaleString(LOCALES[lang]);
}

// 315€ na srpskom, €315 na engleskom.
export function formatEur(n, lang = 'sr') {
  return lang === 'en' ? `€${formatNumber(n, lang)}` : `${formatNumber(n, lang)}€`;
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// YYYY-MM-DD -> "10.11.2026." / "10 Nov 2026" (za poruke i mejlove).
export function formatDate(iso, lang = 'sr') {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return lang === 'en' ? `${Number(d)} ${MONTHS_EN[Number(m) - 1]} ${y}` : `${d}.${m}.${y}.`;
}

export function formatRsd(eur, lang = 'sr') {
  const rsd = formatNumber(Math.round((eur * EUR_TO_RSD) / 10) * 10, lang);
  return lang === 'en' ? `${rsd} RSD` : `${rsd} din`;
}
