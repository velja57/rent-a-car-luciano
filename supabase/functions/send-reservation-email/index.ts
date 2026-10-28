// Supabase Edge Function — šalje email potvrdu kupcu i notifikaciju
// vlasniku preko Resend-a. Poziva se automatski preko Database Webhook-a
// na INSERT u `reservations` (podešavanje: README_RESERVATIONS.md).
//
// Kupac dobija mejl na jeziku sajta na kom je rezervisao (kolona `language`,
// 'sr' ili 'en'), sa procenjenom cenom i dodacima (kolona `price_summary`).
// Vlasnik uvek dobija mejl na srpskom; procena cene i jezik kupca su mu u
// napomeni (isto se vidi i u admin panelu).
//
// Potreban secret: RESEND_API_KEY
// Opciono:
// - RESERVATION_FROM_EMAIL (adresa sa koje se šalje; mora biti verifikovan
//   domen na Resend-u, u suprotnom koristi Resend-ov test domen)
// - OWNER_NOTIFICATION_EMAIL (gde stiže notifikacija o novoj rezervaciji;
//   podrazumevano luciano@gmail.com, isto kao u footeru sajta)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('RESERVATION_FROM_EMAIL') ?? 'onboarding@resend.dev';
const OWNER_EMAIL = Deno.env.get('OWNER_NOTIFICATION_EMAIL') ?? 'luciano@gmail.com';

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(iso: string, lang: 'sr' | 'en' = 'sr') {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return lang === 'en' ? `${Number(d)} ${MONTHS_EN[Number(m) - 1]} ${y}` : `${d}.${m}.${y}.`;
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
    price: 'Procenjena cena',
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
    price: 'Estimated price',
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
  const location = escapeHtml(record.pickup_location);
  const note = record.note ? escapeHtml(record.note) : '';
  const priceSummary = record.price_summary ? escapeHtml(record.price_summary) : '';

  const c = CUSTOMER_TEXT[lang];
  const customerHtml = `
    <div style="font-family: Arial, sans-serif; color: #15171c; line-height: 1.6;">
      <p>${c.greeting(customerName)}</p>
      <p>${c.intro(carName)}</p>
      <ul>
        <li><strong>${c.pickup}:</strong> ${formatDate(pickupDate, lang)}</li>
        <li><strong>${c.return}:</strong> ${formatDate(returnDate, lang)}</li>
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
        <li><strong>Preuzimanje:</strong> ${formatDate(pickupDate)}</li>
        <li><strong>Vraćanje:</strong> ${formatDate(returnDate)}</li>
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
