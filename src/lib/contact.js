import { WHATSAPP_NUMBER } from '../data/rental';
import { discountPercent, formatDate, formatEur, formatRsd, quote, rentalDays } from './pricing';

export function whatsappUrl(text) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

// Kratak opis cene ("7 dana × 45€ (−15%) = 315€ · Dečije sedište 21€ · Ukupno …")
// na traženom jeziku — za mejl kupcu, napomenu vlasniku i WhatsApp poruke.
export function priceLine(t, lang, q) {
  return t.reservation.priceLine({
    days: q.days,
    daysWord: t.days(q.days),
    rate: formatEur(q.rate, lang),
    discount: discountPercent(q.tier),
    rental: formatEur(q.rental, lang),
    extras: q.extras.map((e) => `${t.extras[e.id]} ${e.cost ? formatEur(e.cost, lang) : t.reservation.free}`),
    total: formatEur(q.total, lang),
    rsd: formatRsd(q.total, lang),
  });
}

// Gotova WhatsApp poruka za brzu rezervaciju — vozilo, datumi i cena ako su izabrani.
export function bookingMessage({ t, lang, car, pickup, ret, extraIds = [] }) {
  const days = rentalDays(pickup, ret);
  const dates = days > 0 ? { from: formatDate(pickup, lang), to: formatDate(ret, lang) } : null;
  const price = days > 0 ? priceLine(t, lang, quote(car, days, extraIds)) : null;
  return t.reservation.whatsappBooking(car.name, dates, price);
}

export function questionMessage(t, car) {
  return t.reservation.whatsappQuestion(car.name);
}
