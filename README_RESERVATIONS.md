# Rezervacije — baza, provera dostupnosti, email potvrda

Implementirano: baza podataka (Supabase/Postgres) za rezervacije, provera
dostupnosti vozila po datumu (sprečava preklapanje termina za isto vozilo),
i automatska email potvrda kupcu + notifikacija vlasniku (Resend). WhatsApp
dugme je zadržano kao dodatna opcija — korisnik može i da pošalje WhatsApp
poruku nakon što rezervacija uđe u bazu.

**Dok ne odradiš podešavanje ispod, sajt radi kao i pre** — forma pada na
stari WhatsApp-only tok (bez baze, bez provere dostupnosti, bez emaila).
Ništa se ne kvari, samo nova funkcionalnost nije aktivna.

## Šta treba da uradiš (jednokratno)

### 1. Napravi Supabase projekat

1. Idi na [supabase.com](https://supabase.com) → Sign up / Sign in → New project.
2. Sačekaj da se projekat pokrene (~1-2 min).
3. Settings → API → kopiraj **Project URL** i **anon public** ključ.

### 2. Pokreni šemu baze

1. U Supabase dashboard-u: SQL Editor → New query.
2. Otvori fajl [supabase/schema.sql](supabase/schema.sql) iz ovog projekta, kopiraj kompletan sadržaj, zalepi i pritisni **Run**.
3. Ovo pravi tabelu `reservations` i dve funkcije (`is_car_available`,
   `create_reservation`) koje frontend koristi. Direktan pristup tabeli je
   zaključan (RLS) — niko spolja ne može da čita lične podatke drugih
   kupaca, samo kroz te dve funkcije.

### 3. Podesi env promenljive lokalno

1. Kopiraj `.env.example` u `.env.local` (fajl se ne commit-uje, već je u `.gitignore`).
2. Upiši vrednosti iz koraka 1:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
3. Restartuj `npm run dev` da promenljive učitaju.

Od ovog trenutka baza + provera dostupnosti rade. Email potvrda zahteva
još korake 4-6.

### 4. Napravi Resend nalog (za slanje email potvrde)

1. Idi na [resend.com](https://resend.com) → napravi besplatan nalog.
2. API Keys → Create API key → kopiraj ga (vidljiv samo jednom).
3. (Opciono, preporučeno) Domains → dodaj i verifikuj svoj domen da mejlovi
   idu sa npr. `rezervacije@lucianorentacar.com`. Dok to ne uradiš, mejlovi
   mogu ići sa Resend-ovog test pošiljaoca (`onboarding@resend.dev`) — radi
   za testiranje, ali deluje manje profesionalno kupcima.

### 5. Podesi Edge Function koja šalje mejl

1. U Supabase dashboard-u: Edge Functions → Create a new function → ime:
   `send-reservation-email`.
2. Zalepi sadržaj iz [supabase/functions/send-reservation-email/index.ts](supabase/functions/send-reservation-email/index.ts).
3. Edge Functions → `send-reservation-email` → Settings/Secrets → dodaj:
   - `RESEND_API_KEY` = ključ iz koraka 4
   - `RESERVATION_FROM_EMAIL` = tvoja verifikovana adresa (opciono; ako je
     ne podesiš, koristi se `onboarding@resend.dev`)
   - `OWNER_NOTIFICATION_EMAIL` = adresa na koju stiže notifikacija o novoj
     rezervaciji (opciono; podrazumevano `luciano@gmail.com`, isto kao u
     footeru sajta — promeni ako želiš da notifikacije idu na drugu adresu)
4. Deploy funkciju (dugme u dashboard-u).

(Alternativa za korake 1-4 ako ti je lakše sa terminalom: Supabase CLI —
`supabase functions deploy send-reservation-email` — ali dashboard editor
je dovoljan i ne traži instalaciju ništa dodatno.)

### 6. Poveži bazu i email funkciju (Database Webhook)

1. Database → Webhooks → Create a new webhook.
2. Table: `reservations`, Events: samo **Insert**.
3. Type: Supabase Edge Function → izaberi `send-reservation-email`.
4. Sačuvaj.

Od sada: svaki put kad neko uspešno rezerviše vozilo, automatski se šalje
email potvrda na njegovu adresu.

### 7. Testiraj

1. `npm run dev`, otvori sajt, izaberi vozilo, klikni "Rezerviši odmah".
2. Popuni formu sa datumima — nakon kratke pauze treba da se pojavi "Vozilo
   je dostupno u izabranom periodu."
3. Pošalji — treba da se pojavi "Rezervacija je poslata!" i email treba da
   stigne na unetu adresu u par sekundi.
4. Probaj da rezervišeš isto vozilo za period koji se preklapa sa prethodnom
   rezervacijom — treba da se javi da vozilo nije dostupno.

## Kako da vidiš pristigle rezervacije

Na sajtu postoji admin panel (`/admin.html`) za pregled i otkazivanje
rezervacija — podešavanje u [README_ADMIN.md](README_ADMIN.md).

Alternativno, uvek možeš i direktno: Supabase dashboard → Table Editor →
`reservations`.

## Šta NIJE urađeno (odobreno, čeka se na red — jedna sekcija odjednom)

- Nema admin panela na samom sajtu za pregled/otkazivanje rezervacija.
- Nema stvarnog mehanizma otkazivanja rezervacije (tekst o besplatnom
  otkazivanju je i dalje samo informativan).
- Nema hostinga za sam sajt — radi lokalno (`npm run dev`); kad odlučiš gde
  hostuješ frontend, env promenljive iz koraka 3 treba podesiti i tamo.

## Poznata ograničenja

- Provera dostupnosti u formi (dok kupac bira datume) i finalna provera pri
  slanju su odvojene — ovo je namerno: finalna provera se radi u bazi preko
  constraint-a, pa je sigurna i ako dva kupca pokušaju rez. istovremeno.
- Ako Resend/email padne (bilo kom od dva mejla — kupcu ili tebi), rezervacija
  SE SVEJEDNO upisuje u bazu — samo taj mejl ne stigne. Vredi povremeno
  pogledati Table Editor ako posumnjaš da notifikacija nije stigla.
- Kupac dobija svoj mejl i vlasnik svoj (dva odvojena poziva ka Resend-u, rade
  nezavisno) — ako jedan ne uspe, drugi i dalje stiže.

## Izmena (oktobar 2026): jezik kupca i procena cene u mejlu

Sajt postoji na srpskom i engleskom. Rezervacija sada pamti jezik kupca i
kratak opis procenjene cene sa dodacima; kupac dobija mejl potvrde na svom
jeziku, sa tom cenom. Za to su potrebna dva jednokratna koraka:

1. **Baza:** Supabase → SQL Editor → New query → zalepi i pokreni ceo
   [supabase/schema.sql](supabase/schema.sql) (bezbedno je pokrenuti ponovo).
   Dodaje kolone `language` i `price_summary` i novu verziju funkcije
   `create_reservation`.
2. **Mejl funkcija:** Edge Functions → `send-reservation-email` → zameni kod
   sadržajem [supabase/functions/send-reservation-email/index.ts](supabase/functions/send-reservation-email/index.ts)
   → Deploy.

Redosled nije bitan: dok korak 1 nije urađen, sajt šalje rezervaciju po
starom (bez jezika i cene za kupca), a vlasnik i dalje vidi procenu cene u
napomeni.

## Podsetnik kupcu dan pre preuzimanja (oktobar 2026)

Svako jutro (08:00 UTC = 09:00 zimi / 10:00 leti) Supabase pokreće funkciju
`send-pickup-reminders`. Ona kupcima čije je preuzimanje SUTRA šalje podsetnik
na njihovom jeziku (datum, lokacija, šta da ponesu, telefon) i beleži
`reminder_sent_at`, pa se podsetnik ne šalje dva puta. Jednokratno podešavanje:

1. **Funkcija:** Edge Functions → Deploy a new function → naziv
   `send-pickup-reminders` → zalepi kod iz
   [supabase/functions/send-pickup-reminders/index.ts](supabase/functions/send-pickup-reminders/index.ts) → Deploy.
   Zatim u podešavanjima te funkcije isključi **Verify JWT** (funkciju štiti
   tajni ključ iz koraka 2, a ne JWT).
2. **Tajni ključ:** Edge Functions → Secrets → dodaj `CRON_SECRET` = neka duga
   nasumična lozinka (npr. 30+ slova i brojeva), koju zapamtiš za korak 3.
3. **Raspored:** SQL Editor → zalepi [supabase/podsetnik-cron.sql](supabase/podsetnik-cron.sql),
   zameni `OVDE-TVOJA-TAJNA` istom lozinkom iz koraka 2 → Run.

Napomena: dok domen nije verifikovan u Resend-u, podsetnici (kao i potvrde)
stižu samo na adresu Resend naloga.

## Zaštita od zloupotrebe (novembar 2026)

**Lažne rezervacije.** Funkciju za rezervaciju može da pozove svako ko otvori
sajt, a svaka rezervacija odmah zauzima vozilo. Zato baza (`create_reservation`)
odbija rezervaciju sa sajta kada:

- najam traje duže od **30 dana** (duži se dogovara telefonom, admin ga unosi
  u admin panelu);
- isti telefon ili email već ima **3 buduće aktivne** rezervacije;
- je sa sajta u poslednjih sat vremena stiglo **30 rezervacija** (za ceo sajt).

Kupac tada vidi poruku da pozove telefonom ili piše na WhatsApp. Admin panel
nema ova ograničenja.

**Mejl funkcija.** `send-reservation-email` sada šalje mejl samo kada poziv
nosi tajno zaglavlje `x-webhook-secret`, koje zna samo Database Webhook. Bez
toga bi bilo ko sa javnim ključem sajta mogao da pošalje mejl na bilo koju
adresu u ime firme.

### Šta treba da uradiš (jednokratno, OVIM redom)

1. **Tajna za funkciju:** Edge Functions → Secrets → dodaj `WEBHOOK_SECRET` =
   duga nasumična lozinka (30+ slova i brojeva).
2. **Ista tajna u webhook-u:** Database → Webhooks → webhook za `reservations`
   → Edit → HTTP Headers → Add a new header: ime `x-webhook-secret`, vrednost
   ista lozinka iz koraka 1 → Save.
3. **Nova verzija funkcije:** Edge Functions → `send-reservation-email` →
   zameni kod sadržajem
   [supabase/functions/send-reservation-email/index.ts](supabase/functions/send-reservation-email/index.ts)
   → Deploy.
4. **Baza:** SQL Editor → zalepi ceo [supabase/schema.sql](supabase/schema.sql)
   → Run. Zatim zalepi ceo
   [supabase/tests/admin-panel-test.sql](supabase/tests/admin-panel-test.sql) → Run.
   Očekivano (crvena poruka je namerna):
   `REZULTAT TESTA: 105 od 105 provera uspešno. Sve je u redu.`

Redosled 1 → 2 → 3 je važan: ako se funkcija objavi pre nego što tajna postoji
na oba mesta, mejlovi o rezervacijama ne stižu dok se to ne podesi.
