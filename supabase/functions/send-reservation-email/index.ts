// Supabase Edge Function — šalje email potvrdu kupcu i notifikaciju
// vlasniku preko Resend-a. Poziva se automatski preko Database Webhook-a
// na INSERT u `reservations` (podešavanje: README_RESERVATIONS.md).
// Rezervacije koje unosi admin (kolona `source` = 'admin') se preskaču.
//
// Kupac dobija mejl na jeziku sajta na kom je rezervisao (kolona `language`,
// 'sr' ili 'en'), sa vremenom preuzimanja i vraćanja (kolone `pickup_time`,
// `return_time`), iznosom i dodacima (kolona `price_summary`).
// Vlasnik uvek dobija mejl na srpskom; iznos i jezik kupca su mu u
// napomeni (isto se vidi i u admin panelu).
//
// Potrebni secrets:
// - RESEND_API_KEY
// - WEBHOOK_SECRET: duga nasumična lozinka. Isti tekst mora biti u Database
//   Webhook-u kao HTTP zaglavlje x-webhook-secret. Bez nje funkciju bi mogao da
//   pozove bilo ko sa javnim ključem sajta i pošalje mejl na bilo koju adresu.
// Opciono:
// - RESERVATION_FROM_EMAIL (adresa sa koje se šalje; mora biti verifikovan
//   domen na Resend-u, u suprotnom koristi Resend-ov test domen)
// - OWNER_NOTIFICATION_EMAIL (gde stiže notifikacija o novoj rezervaciji;
//   podrazumevano luciano@gmail.com, isto kao u footeru sajta)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');
const FROM_EMAIL = Deno.env.get('RESERVATION_FROM_EMAIL') ?? 'onboarding@resend.dev';
const OWNER_EMAIL = Deno.env.get('OWNER_NOTIFICATION_EMAIL') ?? 'luciano@gmail.com';

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(iso: string, lang: 'sr' | 'en' = 'sr') {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return lang === 'en' ? `${Number(d)} ${MONTHS_EN[Number(m) - 1]} ${y}` : `${d}.${m}.${y}.`;
}

// Datum i vreme ("10:00:00" iz baze): "09.11.2026. u 10:00" / "9 Nov 2026 at 10:00".
// Starije rezervacije i one iz admin panela mogu biti bez vremena — tada samo datum.
function formatDateTime(iso: string, time: unknown, lang: 'sr' | 'en' = 'sr') {
  const clock = typeof time === 'string' && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : '';
  if (!clock) return formatDate(iso, lang);
  return `${formatDate(iso, lang)} ${lang === 'en' ? 'at' : 'u'} ${clock}`;
}

// Sve vrednosti dolaze iz javne forme na sajtu — pre ubacivanja u HTML mejla
// moraju se "escape"-ovati, da niko ne može da ubaci svoj HTML/link u mejl.
function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const CUSTOMER_TEXT = {
  sr: {
    subject: 'Potvrda rezervacije — Luciano Rent a Car',
    greeting: (name: string) => `Zdravo ${name},`,
    intro: (car: string) => `Tvoja rezervacija za vozilo <strong>${car}</strong> je zabeležena u sistemu.`,
    pickup: 'Preuzimanje',
    return: 'Vraćanje',
    location: 'Lokacija preuzimanja',
    price: 'Iznos',
    closing:
      'Javićemo se uskoro telefonom ili mejlom da potvrdimo sve detalje. Hvala što si izabrao Luciano Rent a Car!',
  },
  en: {
    subject: 'Booking confirmation — Luciano Rent a Car',
    greeting: (name: string) => `Hi ${name},`,
    intro: (car: string) => `Your booking for the <strong>${car}</strong> has been recorded.`,
    pickup: 'Pick-up',
    return: 'Return',
    location: 'Pick-up location',
    price: 'Price',
    closing:
      "We'll contact you shortly by phone or email to confirm all the details. Thank you for choosing Luciano Rent a Car!",
  },
};

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    return { ok: false, error: await res.text() };
  }
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  // Samo Database Webhook zna tajnu. Ako tajna nije podešena, funkcija ne šalje
  // ništa (bolje bez mejla nego otvorena za zloupotrebu).
  if (!WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'WEBHOOK_SECRET nije podešen' }), { status: 500 });
  }
  if (req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY nije podešen' }), { status: 500 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Neispravan JSON' }), { status: 400 });
  }

  // Supabase Database Webhook šalje { type: 'INSERT', table, record, old_record, schema }
  const record = (payload as { record?: Record<string, unknown> })?.record;

  // Rezervacija koju je uneo admin (npr. posle telefonskog poziva) — bez mejla,
  // ni kupcu ni vlasniku.
  if (record?.source === 'admin') {
    return new Response(JSON.stringify({ skipped: 'admin' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!record || typeof record.email !== 'string') {
    return new Response(JSON.stringify({ error: 'Nedostaje record/email u payload-u' }), { status: 400 });
  }

  const lang: 'sr' | 'en' = record.language === 'en' ? 'en' : 'sr';
  const customerEmail = String(record.email ?? '');
  const customerName = escapeHtml(record.customer_name);
  const customerPhone = escapeHtml(record.phone);
  const dob = String(record.date_of_birth ?? '');
  const carName = escapeHtml(record.car_name);
  const pickupDate = String(record.pickup_date ?? '');
  const returnDate = String(record.return_date ?? '');
  const pickupTime = record.pickup_time;
  const returnTime = record.return_time;
  const location = escapeHtml(record.pickup_location);
  const note = record.note ? escapeHtml(record.note) : '';
  const priceSummary = record.price_summary ? escapeHtml(record.price_summary) : '';

  const c = CUSTOMER_TEXT[lang];
  const customerHtml = `
    <div style="font-family: Arial, sans-serif; color: #15171c; line-height: 1.6;">
      <p>${c.greeting(customerName)}</p>
      <p>${c.intro(carName)}</p>
      <ul>
        <li><strong>${c.pickup}:</strong> ${formatDateTime(pickupDate, pickupTime, lang)}</li>
        <li><strong>${c.return}:</strong> ${formatDateTime(returnDate, returnTime, lang)}</li>
        <li><strong>${c.location}:</strong> ${location}</li>
        ${priceSummary ? `<li><strong>${c.price}:</strong> ${priceSummary}</li>` : ''}
      </ul>
      <p>${c.closing}</p>
    </div>
  `;

  const ownerHtml = `
    <div style="font-family: Arial, sans-serif; color: #15171c; line-height: 1.6;">
      <p>Stigla je nova rezervacija.</p>
      <ul>
        <li><strong>Vozilo:</strong> ${carName}</li>
        <li><strong>Ime i prezime:</strong> ${customerName}</li>
        <li><strong>Telefon:</strong> ${customerPhone}</li>
        <li><strong>Email:</strong> ${escapeHtml(customerEmail)}</li>
        <li><strong>Datum rođenja:</strong> ${dob ? formatDate(dob) : '-'}</li>
        <li><strong>Preuzimanje:</strong> ${formatDateTime(pickupDate, pickupTime)}</li>
        <li><strong>Vraćanje:</strong> ${formatDateTime(returnDate, returnTime)}</li>
        <li><strong>Lokacija preuzimanja:</strong> ${location}</li>
        ${note ? `<li><strong>Napomena:</strong> ${note}</li>` : ''}
      </ul>
      <p>Pregled svih rezervacija: Supabase dashboard → Table Editor → reservations.</p>
    </div>
  `;

  const [customerResult, ownerResult] = await Promise.all([
    sendEmail(customerEmail, c.subject, customerHtml),
    // Subject je običan tekst (ne HTML), zato originalne vrednosti bez escape-a.
    sendEmail(OWNER_EMAIL, `Nova rezervacija: ${String(record.car_name ?? '')} — ${String(record.customer_name ?? '')}`, ownerHtml),
  ]);

  if (!customerResult.ok || !ownerResult.ok) {
    return new Response(
      JSON.stringify({
        success: false,
        customerEmailError: customerResult.ok ? null : customerResult.error,
        ownerEmailError: ownerResult.ok ? null : ownerResult.error,
      }),
      { status: 502 },
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
