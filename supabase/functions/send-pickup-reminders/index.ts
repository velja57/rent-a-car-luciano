// Supabase Edge Function — podsetnik kupcu dan pre preuzimanja vozila.
// Pokreće je svako jutro Supabase Cron (supabase/podsetnik-cron.sql). Sama
// čita iz baze rezervacije koje se preuzimaju SUTRA (po beogradskom vremenu),
// šalje mejl na jeziku kupca (kolona `language`) i upisuje `reminder_sent_at`,
// pa se podsetnik nikad ne šalje dva puta. Ne prima podatke spolja.
//
// Potrebni secrets: RESEND_API_KEY (isti kao za potvrdu rezervacije) i
// CRON_SECRET (tajna koju šalje Cron u zaglavlju x-cron-secret).
// SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY Supabase daje sam.
// Opciono: RESERVATION_FROM_EMAIL (kao kod potvrde rezervacije).

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('RESERVATION_FROM_EMAIL') ?? 'onboarding@resend.dev';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const CRON_SECRET = Deno.env.get('CRON_SECRET');

// Telefon za pitanja u podsetniku (isti kao na sajtu).
const CONTACT_PHONE = '060 484 8086';

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Reservation = {
  id: string;
  email: string;
  customer_name: string;
  car_name: string;
  pickup_date: string;
  pickup_time: string | null;
  pickup_location: string;
  language: string | null;
};

function formatDate(iso: string, lang: 'sr' | 'en') {
  const [y, m, d] = iso.split('-');
  return lang === 'en' ? `${Number(d)} ${MONTHS_EN[Number(m) - 1]} ${y}` : `${d}.${m}.${y}.`;
}

// Datum i vreme preuzimanja ("10:00:00" iz baze): "09.11.2026. u 10:00" / "9 Nov 2026 at 10:00".
// Rezervacija bez upisanog vremena (npr. uneta u adminu) — samo datum.
function formatDateTime(iso: string, time: string | null, lang: 'sr' | 'en') {
  const clock = time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : '';
  return clock ? `${formatDate(iso, lang)} ${lang === 'en' ? 'at' : 'u'} ${clock}` : formatDate(iso, lang);
}

// Sutrašnji datum (YYYY-MM-DD) po beogradskom vremenu.
function tomorrowInBelgrade() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Belgrade' }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

// Vrednosti iz baze potiču iz javne forme — escape pre ubacivanja u HTML.
function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const TEXT = {
  sr: {
    subject: (car: string) => `Podsetnik: sutra preuzimaš vozilo ${car}`,
    greeting: (name: string) => `Zdravo ${name},`,
    intro: (date: string, car: string) => `podsećamo te da sutra, <strong>${date}</strong>, preuzimaš vozilo <strong>${car}</strong>.`,
    location: 'Lokacija preuzimanja',
    bring: 'Ne zaboravi: vozačku dozvolu i ličnu kartu ili pasoš.',
    help: `Ako ti nešto zatreba ili kasniš, pozovi nas ili piši na WhatsApp: ${CONTACT_PHONE}.`,
    closing: 'Srećan put! — Luciano Rent a Car',
  },
  en: {
    subject: (car: string) => `Reminder: you are picking up the ${car} tomorrow`,
    greeting: (name: string) => `Hi ${name},`,
    intro: (date: string, car: string) => `this is a reminder that tomorrow, <strong>${date}</strong>, you are picking up the <strong>${car}</strong>.`,
    location: 'Pick-up location',
    bring: 'Please bring your driving licence and your ID card or passport.',
    help: `If you need anything or are running late, call or WhatsApp us: +381 ${CONTACT_PHONE.slice(1)}.`,
    closing: 'Have a great trip! — Luciano Rent a Car',
  },
};

function reminderHtml(r: Reservation, lang: 'sr' | 'en') {
  const t = TEXT[lang];
  return `
    <div style="font-family: Arial, sans-serif; color: #15171c; line-height: 1.6;">
      <p>${t.greeting(escapeHtml(r.customer_name))}</p>
      <p>${t.intro(formatDateTime(r.pickup_date, r.pickup_time, lang), escapeHtml(r.car_name))}</p>
      <ul>
        <li><strong>${t.location}:</strong> ${escapeHtml(r.pickup_location)}</li>
      </ul>
      <p>${t.bring}</p>
      <p>${t.help}</p>
      <p>${t.closing}</p>
    </div>
  `;
}

function db(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY ?? '',
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  return res.ok ? { ok: true } : { ok: false, error: await res.text() };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (!RESEND_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: 'Nedostaje RESEND_API_KEY, SUPABASE_URL ili SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  const date = tomorrowInBelgrade();
  const query = new URLSearchParams({
    select: 'id,email,customer_name,car_name,pickup_date,pickup_time,pickup_location,language',
    status: 'eq.confirmed',
    pickup_date: `eq.${date}`,
    reminder_sent_at: 'is.null',
  });
  const res = await db(`reservations?${query}`);
  if (!res.ok) {
    return json({ error: 'Ne mogu da pročitam rezervacije', details: await res.text() }, 502);
  }
  const reservations: Reservation[] = await res.json();

  const results = [];
  for (const r of reservations) {
    const lang: 'sr' | 'en' = r.language === 'en' ? 'en' : 'sr';
    const sent = await sendEmail(r.email, TEXT[lang].subject(r.car_name), reminderHtml(r, lang));
    if (sent.ok) {
      await db(`reservations?id=eq.${encodeURIComponent(r.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ reminder_sent_at: new Date().toISOString() }),
      });
    }
    results.push({ id: r.id, sent: sent.ok, error: sent.ok ? null : sent.error });
  }

  return json({ date, found: reservations.length, sent: results.filter((r) => r.sent).length, results });
});
