import { DISCOUNT_TIERS, EUR_TO_RSD, EXTRAS } from '../data/rental';

const DAY_MS = 86_400_000;

export const MAX_DISCOUNT_PERCENT = Math.round(Math.max(...DISCOUNT_TIERS.map((t) => t.discount)) * 100);

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Broj dana najma između dva datuma (YYYY-MM-DD); 0 ako period nije ispravan.
export function rentalDays(pickup, ret) {
  if (!pickup || !ret) return 0;
  const days = Math.round((Date.parse(ret) - Date.parse(pickup)) / DAY_MS);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

export function formatDays(n) {
  return n % 10 === 1 && n % 100 !== 11 ? 'dan' : 'dana';
}

export function tierFor(days) {
  return DISCOUNT_TIERS.reduce((found, tier) => (days >= tier.minDays ? tier : found), DISCOUNT_TIERS[0]);
}

export function dailyRate(car, days = 1) {
  return Math.round(car.pricePerDay * (1 - tierFor(days).discount));
}

// Najniža dnevna cena (najduži najam) — za prikaz "od X€".
export function lowestRate(car) {
  return dailyRate(car, DISCOUNT_TIERS[DISCOUNT_TIERS.length - 1].minDays);
}

export function quote(car, days, extraIds = []) {
  const rate = dailyRate(car, days);
  const rental = rate * days;
  const extras = EXTRAS.filter((e) => extraIds.includes(e.id)).map((e) => ({
    ...e,
    cost: e.per === 'day' ? e.price * days : e.price,
  }));
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

export function formatRsd(eur) {
  return `${(Math.round((eur * EUR_TO_RSD) / 10) * 10).toLocaleString('sr-RS')} din`;
}

// deposit: broj (EUR) ili null = bez depozita.
export function depositLabel(deposit) {
  return deposit ? `${deposit}€` : 'Bez depozita';
}
