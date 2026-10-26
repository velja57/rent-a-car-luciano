// Supabase Edge Function — šalje email potvrdu kupcu i notifikaciju
// vlasniku preko Resend-a. Poziva se automatski preko Database Webhook-a
// na INSERT u `reservations` (podešavanje: README_RESERVATIONS.md).
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

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}.`;
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
  if (!res.ok) {
    return { ok: false, error: await res.text() };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
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

  const customerName = String(record.customer_name ?? '');
  const customerEmail = String(record.email ?? '');
  const customerPhone = String(record.phone ?? '');
  const dob = String(record.date_of_birth ?? '');
  const carName = String(record.car_name ?? '');
  const pickupDate = String(record.pickup_date ?? '');
  const returnDate = String(record.return_date ?? '');
  const location = String(record.pickup_location ?? '');
  const note = record.note ? String(record.note) : '';

  const customerHtml = `
    <div style="font-family: Arial, sans-serif; color: #15171c; line-height: 1.6;">
      <p>Zdravo ${customerName},</p>
      <p>Tvoja rezervacija za vozilo <strong>${carName}</strong> je zabeležena u sistemu.</p>
      <ul>
        <li><strong>Preuzimanje:</strong> ${formatDate(pickupDate)}</li>
        <li><strong>Vraćanje:</strong> ${formatDate(returnDate)}</li>
        <li><strong>Lokacija preuzimanja:</strong> ${location}</li>
      </ul>
      <p>Javićemo se uskoro telefonom ili mejlom da potvrdimo sve detalje. Hvala što si izabrao Luciano Rent a Car!</p>
    </div>
  `;

  const ownerHtml = `
    <div style="font-family: Arial, sans-serif; color: #15171c; line-height: 1.6;">
      <p>Stigla je nova rezervacija.</p>
      <ul>
        <li><strong>Vozilo:</strong> ${carName}</li>
        <li><strong>Ime i prezime:</strong> ${customerName}</li>
        <li><strong>Telefon:</strong> ${customerPhone}</li>
        <li><strong>Email:</strong> ${customerEmail}</li>
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
    sendEmail(customerEmail, 'Potvrda rezervacije — Luciano Rent a Car', customerHtml),
    sendEmail(OWNER_EMAIL, `Nova rezervacija: ${carName} — ${customerName}`, ownerHtml),
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
