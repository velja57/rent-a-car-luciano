import { formatDate as formatSiteDate, formatEur } from '../../lib/pricing';

const TIME_ZONE = 'Europe/Belgrade';

// YYYY-MM-DD -> "10.11.2026." (isti format kao na sajtu i u mejlovima).
export function formatDate(iso) {
  return iso ? formatSiteDate(iso, 'sr') : '—';
}

// "10:00:00" -> "10:00"
export function formatTime(time) {
  return time ? time.slice(0, 5) : '';
}

export function formatDateWithTime(date, time) {
  const t = formatTime(time);
  return t ? `${formatDate(date)} u ${t}` : formatDate(date);
}

// Vreme iz baze (UTC) -> "29.10.2026. 14:32" po beogradskom vremenu.
export function formatDateTime(timestamp) {
  if (!timestamp) return '—';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(timestamp))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.day}.${parts.month}.${parts.year}. ${parts.hour}:${parts.minute}`;
}

// Iznos u evrima: 120 -> "120€"; null -> "—".
export function formatMoney(amount) {
  if (amount === null || amount === undefined || amount === '') return '—';
  return formatEur(Math.round(Number(amount) * 100) / 100, 'sr');
}

// Današnji datum (YYYY-MM-DD) po beogradskom vremenu.
export function todayBelgrade() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
}

// Kratak ID za prikaz i pretragu (prvih 8 znakova UUID-a).
export function shortId(id) {
  return id ? id.slice(0, 8) : '';
}

export function ageFrom(dob) {
  if (!dob) return null;
  const [y, m, d] = dob.split('-').map(Number);
  const [ty, tm, td] = todayBelgrade().split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}
