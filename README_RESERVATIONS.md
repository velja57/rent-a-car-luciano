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
