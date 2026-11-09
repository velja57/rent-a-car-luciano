import { RENTAL_HOURS } from '../data/rental';
import { rentalDays } from './pricing';

// Vreme preuzimanja i vraćanja — ista pravila kao u bazi (reservation_span i
// rental_days_between u supabase/schema.sql). Vreme se računa u minutima od
// 1.1.1970 bez vremenske zone (kao "timestamp" u bazi), pa se dani ne pomeraju.

const DAY_MINUTES = 1440;

// "10:30" -> 630
export function minutesOf(time) {
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function clock(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Datum (YYYY-MM-DD) + vreme -> minuti.
export function minutesAt(date, time = '00:00') {
  return Date.parse(`${date}T00:00:00Z`) / 60000 + minutesOf(time);
}

// Ponuđena vremena: od 08:00 do 20:00 na pola sata.
export const TIME_SLOTS = (() => {
  const slots = [];
  for (let m = minutesOf(RENTAL_HOURS.from); m <= minutesOf(RENTAL_HOURS.to); m += RENTAL_HOURS.stepMinutes) {
    slots.push(clock(m));
  }
  return slots;
})();

// Radni dan (pon–pet) — samo tada se preko sajta preuzima i vraća.
export function isWorkday(date) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
  return RENTAL_HOURS.weekdays.includes(weekday);
}

// Podrazumevano vreme preuzimanja: 10:00 ako je slobodno, inače prvo slobodno.
export function defaultPickupTime(options) {
  return options.includes('10:00') ? '10:00' : (options[0] ?? '');
}

// Podrazumevano vreme vraćanja: isto kao preuzimanje (pun broj dana), inače
// najkasnije pre njega (bez dodatnog dana), inače prvo slobodno.
export function defaultReturnTime(options, pickupTime) {
  if (options.includes(pickupTime)) return pickupTime;
  return options.filter((time) => time < pickupTime).pop() ?? options[0] ?? '';
}

// Zauzetost rezervacije: od preuzimanja do vraćanja + 2 h pripreme; bez
// upisanog vremena — od početka dana preuzimanja do kraja dana vraćanja.
export function reservationSpan(r) {
  const start = minutesAt(r.pickup_date, r.pickup_time ?? '00:00');
  const end = r.return_time
    ? minutesAt(r.return_date, r.return_time) + RENTAL_HOURS.bufferMinutes
    : minutesAt(addDays(r.return_date, 1));
  return { start, end };
}

export function spansOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

// Dani najma: 24 h od preuzimanja; vraćanje do 59 min kasnije se ne računa,
// a svaka započeta 24 h posle toga je novi dan. Bez vremena = razlika datuma.
export function billableDays(pickupDate, pickupTime, returnDate, returnTime) {
  const days = rentalDays(pickupDate, returnDate);
  if (days <= 0 || !pickupTime || !returnTime) return days;
  return minutesOf(returnTime) - minutesOf(pickupTime) > RENTAL_HOURS.graceMinutes ? days + 1 : days;
}

// Najkasnije vraćanje bez novog dana (vreme preuzimanja + tolerancija).
export function graceUntil(pickupTime) {
  return clock(Math.min(minutesOf(pickupTime) + RENTAL_HOURS.graceMinutes, DAY_MINUTES - 1));
}

// Sada po beogradskom vremenu, u istim minutima kao minutesAt().
export function nowInBelgrade() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Belgrade',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return minutesAt(`${parts.year}-${parts.month}-${parts.day}`, `${parts.hour}:${parts.minute}`);
}

// Slobodna vremena preuzimanja tog dana: radni dan, nije prošlo i nije u tuđem terminu.
export function pickupSlots(date, booked, now = nowInBelgrade()) {
  if (!date || !isWorkday(date)) return [];
  const spans = booked.map(reservationSpan);
  return TIME_SLOTS.filter((time) => {
    const minute = minutesAt(date, time);
    return minute > now && !spans.some((s) => minute >= s.start && minute < s.end);
  });
}

// Slobodna vremena vraćanja: ceo najam (od preuzimanja do vraćanja + 2 h
// pripreme) ne sme da dira tuđi termin.
export function returnSlots(pickupDate, pickupTime, returnDate, booked) {
  if (!pickupDate || !pickupTime || !returnDate || !isWorkday(returnDate)) return [];
  const spans = booked.map(reservationSpan);
  const start = minutesAt(pickupDate, pickupTime);
  return TIME_SLOTS.filter((time) => {
    const end = minutesAt(returnDate, time);
    const mine = { start, end: end + RENTAL_HOURS.bufferMinutes };
    return end > start && !spans.some((s) => spansOverlap(mine, s));
  });
}

// Dani u kalendaru sajta kada se zbog tuđih termina ne može preuzeti, odnosno
// vratiti vozilo (između 08 i 20 h). Dan kada drugi kupac vraća auto može biti
// dan preuzimanja (ako posle vraćanja + 2 h ostaje vremena do 20 h), a dan kada
// drugi kupac preuzima može biti dan vraćanja (ako 2 h pre toga ima vremena od 08 h).
export function blockedDays(booked) {
  const noPickup = new Set();
  const noReturn = new Set();
  const first = minutesOf(RENTAL_HOURS.from);
  const last = minutesOf(RENTAL_HOURS.to);
  booked.forEach((r) => {
    for (let day = r.pickup_date; day <= r.return_date; day = addDays(day, 1)) {
      if (day === r.pickup_date) {
        noPickup.add(day);
        const start = r.pickup_time ? minutesOf(r.pickup_time) : 0;
        if (start - RENTAL_HOURS.bufferMinutes < first) noReturn.add(day);
      } else if (day === r.return_date) {
        noReturn.add(day);
        const free = r.return_time ? minutesOf(r.return_time) + RENTAL_HOURS.bufferMinutes : DAY_MINUTES;
        if (free > last) noPickup.add(day);
      } else {
        noPickup.add(day);
        noReturn.add(day);
      }
    }
  });
  return { noPickup, noReturn };
}
