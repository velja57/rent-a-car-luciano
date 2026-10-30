# Admin panel — pregled i otkazivanje rezervacija

Zaseban deo sajta, dostupan na `/admin.html`, gde se prijavljuješ i vidiš sve
rezervacije (ime, kontakt, datumi, lokacija, napomena, status) i možeš da
otkažeš bilo koju aktivnu rezervaciju. Otkazana rezervacija automatski
oslobađa te datume za nova rezervisanja.

Ovo JE jedini način za otkazivanje (nema samostalnog otkazivanja od strane
kupca preko linka) — po dogovoru, kupac tebe kontaktira da otkaže, a ti to
potvrdiš ovde.

Radi samo ako je Supabase već podešen (vidi [README_RESERVATIONS.md](README_RESERVATIONS.md), koraci 1-3). Ako nije, `/admin.html` prikazuje samo poruku da treba podesiti Supabase.

## Podešavanje (jednokratno)

### 1. Napravi admin nalog

1. Supabase dashboard → Authentication → Users → **Add user**.
2. Upiši email i lozinku koju ćeš koristiti za prijavu na `/admin.html`.
   (Može biti bilo koja adresa — ne mora biti ista kao `luciano@gmail.com` iz
   footera; preporuka: adresa koju samo ti koristiš.)
3. "Auto Confirm User" uključi (da ne mora email verifikacija da bi mogao da se uloguješ).

### 2. Zabrani javnu registraciju (VAŽNO)

Supabase podrazumevano dozvoljava da se bilo ko sam registruje. Pošto admin
panel pokazuje lične podatke kupaca (ime, telefon, email, datum rođenja),
ovo MORA biti isključeno:

1. Authentication → Providers → Email.
2. Isključi **"Allow new users to sign up"**.
3. Sačuvaj.

Od sada se jedini nalog koji postoji (napravljen u koraku 1) može prijaviti —
niko spolja ne može da napravi novi nalog.

### 3. Pokreni dodatak šeme baze

1. SQL Editor → New query.
2. Otvori [supabase/schema.sql](supabase/schema.sql) — fajl je ažuriran,
   sadrži i deo za admin pristup na kraju (sekcija "ADMIN PANEL").
3. **PRE pokretanja**, u tom delu fajla zameni `ADMIN_EMAIL_OVDE` (pojavljuje
   se na dva mesta) TAČNO email adresom iz koraka 1.
4. Zalepi ceo fajl i pritisni **Run**. Bezbedno je pokrenuti i ako si već
   pokretao raniju verziju — sve je idempotentno (`IF NOT EXISTS` / `OR REPLACE`).

### 4. Testiraj

1. `npm run dev`, otvori `http://localhost:5173/admin.html` (ili koji god
   port Vite prijavi).
2. Prijavi se sa nalogom iz koraka 1.
3. Trebalo bi da vidiš listu rezervacija (ili praznu listu ako ih još nema).
4. Probaj "Otkaži" na jednoj — status treba da se promeni u "Otkazana", a
   ta rezervacija više ne bi trebalo da blokira te datume za novo
   rezervisanje istog vozila.

## Novi admin panel — faza 1: baza (oktobar 2026)

Baza je pripremljena za novi admin panel (rezervacije, kalendar, uplate,
finansije). Sam izgled panela dolazi u sledećim fazama; do tada `/admin`
radi kao i pre. Sve izmene samo DODAJU — nijedna postojeća rezervacija se ne
menja i sajt radi kao i pre (i pre i posle pokretanja SQL-a).

Šta je novo u [supabase/schema.sql](supabase/schema.sql):

- **Statusi:** Potvrđena → Preuzeta → Završena, plus Otkazana i „Nije se
  pojavio“. Otkazana i „nije se pojavio“ oslobađaju datume; ostale ih
  zauzimaju. Dan vraćanja je i dalje zauzet (kao do sada).
- **Rezervacija** dobija: iznos (EUR) i dodatke kao podatke, vreme
  preuzimanja/vraćanja, mesto vraćanja, izvor (sajt/admin). Za rezervacije
  primljene telefonom email i datum rođenja nisu obavezni (forma na sajtu ih
  i dalje traži).
- **Uplate** (ručno beleženje): uplata/avans, povraćaj, primljena i vraćena
  kaucija. Kaucija se ne računa kao prihod. Pogrešna stavka se poništava, ne
  briše.
- **Istorija promena:** svaka izmena rezervacije i uplate se automatski
  beleži (šta, ko, kada).
- **Registarske oznake** vozila (vozila su i dalje u `src/data/fleet.js`).
- **Admin nalozi** su u tabeli `admin_users` umesto upisane adrese u kodu.
  Drugi admin se dodaje u SQL Editoru:
  `insert into admin_users (email) values ('nova@adresa.com');`
  (plus nalog u Authentication → Users sa istom adresom).

### Šta treba da uradiš (jednokratno)

1. **Pokreni šemu:** Supabase → SQL Editor → New query → otvori
   [supabase/schema.sql](supabase/schema.sql), kopiraj CEO sadržaj, zalepi →
   **Run**. Treba da piše „Success. No rows returned“.
2. **Pokreni test:** SQL Editor → New query → zalepi ceo
   [supabase/tests/admin-panel-test.sql](supabase/tests/admin-panel-test.sql)
   → **Run**. Rezultat se pojavljuje kao crvena poruka „ERROR“ — to je
   namerno (tako baza poništi sve što je test upisao). Treba da piše:
   `REZULTAT TESTA: 44 od 44 provera uspešno. Sve je u redu.`
   Test koristi izmišljeno vozilo i 2099. godinu — prave rezervacije ne dira,
   ništa ne ostaje u bazi i ne šalje se nijedan mejl.
3. **Proveri registraciju:** Authentication → Sign In / Providers → Email →
   „Allow new users to sign up“ mora biti **isključeno**.

## Novi admin panel — faza 2: izgled i rezervacije (oktobar 2026)

Posle prijave na `/admin`:

- **Pregled** — današnja preuzimanja i vraćanja, vozila kod kupaca, broj
  rezervacija po statusu.
- **Rezervacije** — pretraga (ime, telefon, email, vozilo, registracija, ID),
  filteri (status, vozilo, period), sortiranje klikom na naslov kolone,
  po 25 na strani. Klik na red otvara detalj.
- **Detalj** — svi podaci, promena statusa (uvek uz potvrdu), istorija
  promena (ko je šta promenio i kada).
- **Izmena i nova rezervacija** — dok biraš vozilo i datume, panel proverava
  da li je vozilo slobodno i predlaže iznos po cenovniku sajta (možeš ga
  promeniti). Zauzet termin se ne može sačuvati (proverava i baza).
- Na telefonu se meni otvara dugmetom ☰ gore levo, a tabela postaje kartice.

### Šta treba da uradiš (jednokratno)

Ručno uneta rezervacija (npr. posle poziva) ne treba da šalje mejl ni kupcu
ni tebi. Za to: Supabase → **Edge Functions** → `send-reservation-email` →
zameni kod sadržajem
[supabase/functions/send-reservation-email/index.ts](supabase/functions/send-reservation-email/index.ts)
→ **Deploy**. Dok to ne uradiš, ručno uneta rezervacija sa emailom bi
poslala potvrdu kao da je sa sajta.

## Novi admin panel — faza 3: kalendar i vozila (oktobar 2026)

- **Kalendar** — svako vozilo je jedan red, svaka rezervacija traka od dana
  preuzimanja do dana vraćanja (uključujući dan vraćanja, kao što računa i
  sajt). Boja = status. Prikaz po mesecu ili 2 nedelje, „Prethodni / Danas /
  Sledeći“. Otkazane i „nije se pojavio“ se prikazuju samo ako se uključi
  opcija (precrtane). Klik na traku otvara rezervaciju, klik na prazan dan
  otvara novu rezervaciju za to vozilo i taj datum. Ako bi se dve aktivne
  rezervacije istog vozila ikad preklopile (baza to ne dozvoljava), kalendar
  ih označava crveno i prikazuje upozorenje.
- **Vozila** — unos registarske oznake i interne beleške za svako vozilo.
  Oznaka se vidi u listi, detalju i kalendaru, i po njoj radi pretraga.
  Ovo se ne prikazuje na sajtu.

Za ovu fazu ne treba ništa podešavati u Supabase-u.

## Novi admin panel — faza 4: cenovnik, cene rezervacija, uplate i analitika (oktobar 2026)

### Kako sada radi cena

- **Cenovnik je u bazi** i menja se u adminu: **Vozila i cenovnik** (cena po
  danu svakog vozila, popust za duži najam, cene dodataka). Sajt prikazuje
  cene iz baze, pa promena važi odmah na sajtu i za nove rezervacije.
- **Iznos svake rezervacije računa baza** po tom cenovniku (i kad rezervacija
  dolazi sa sajta). Ako je kupac na sajtu video drugačiji iznos (npr.
  stranica otvorena pre promene cene), rezervacija važi po cenovniku, a u
  napomeni stoji upozorenje.
- Uz rezervaciju se čuva **snimak cene**: cena po danu, popust, broj dana,
  najam, dodaci i ukupno. Kasnija promena cenovnika **ne menja** postojeće
  rezervacije (Škoda rezervisana po 40 €/dan ostaje 2 × 40 = 80 € i kad
  cena postane 45 €).
- U detalju rezervacije sekcija **Cena** prikazuje samo **Iznos** (sa
  „2 dana × 40 € = 80 €“) i **Dodatke**. U „Izmeni“ se menjaju cena po danu i
  iznos dodataka — najam i ukupno računa baza. Kad se promene datumi, cena po
  danu ostaje ona iz trenutka rezervacije (dugme „Primeni cenovnik“ je menja
  na današnju).
- **Uplate** (u detalju rezervacije): ručno beleženje uplate/avansa, povraćaja
  i kaucije. „Naplaćeno“ je samo zabeleženo — potvrđena rezervacija se nikad
  ne računa kao plaćena. Kaucija nije prihod.

### Analitika prihoda (meni „Analitika prihoda“)

- Ukupan prihod, najam, dodaci, broj rezervacija, prosek po rezervaciji,
  prihod po svakom vozilu (klik na vozilo = detalj), grafikon kroz vreme.
- Period: dan, mesec, godina ili raspon.
- **Po danima najma** — iznos rezervacije je raspoređen na dane kada je
  vozilo kod kupca (od dana preuzimanja do dana pre vraćanja — isti broj dana
  kao na sajtu). Rezervacija 29.–31.10. po 40 € → 29.10. 40 €, 30.10. 40 €.
  Zbir dana je uvek tačno iznos rezervacije (bez grešaka u zaokruživanju).
- **Po datumu rezervacije** — ceo iznos na dan kada je rezervacija napravljena.
- **Ugovoreno** = potvrđene, preuzete i završene; **Realizovano** = samo
  završene. Otkazane i „nije se pojavio“ se ne računaju. Povraćaj umanjuje
  prihod (prvo najam, ostatak dodatke). „Naplaćeno u periodu“ je odvojeno —
  to su stvarno zabeležene uplate.
- Sve se računa iz trenutnih podataka, pa izmena datuma ili cene odmah važi i
  ništa se ne broji dvaput.

### Stare rezervacije

Uz svaku rezervaciju sa sajta sačuvan je tekst obračuna (npr. „2 dana × 38€ =
76€ · Ukupno 76€“). Iz njega se cena popunjava **samo ako se sve slaže** (broj
dana sa datumima, cena × dani = najam). Ostale ostaju „bez cene“ — analitika
ih ne sabira i prikazuje koliko ih ima; cenu im upišeš preko „Izmeni“.

### Šta treba da uradiš (jednokratno)

1. Supabase → **SQL Editor** → New query → zalepi ceo
   [supabase/schema.sql](supabase/schema.sql) → **Run** („Success“).
2. Novi query → zalepi ceo
   [supabase/tests/admin-panel-test.sql](supabase/tests/admin-panel-test.sql)
   → **Run**. Očekivano (crvena poruka je namerna):
   `REZULTAT TESTA: 63 od 63 provera uspešno. Sve je u redu.`

Mejl funkcije ne treba ponovo objavljivati za ovu fazu.

## Kad sajt bude hostovan

Admin panel će biti dostupan na `<tvoj-domen>/admin.html`. Kad budemo radili
hosting (Vercel), mogu da podesim i da radi na lepšem `/admin` umesto
`/admin.html`, ako želiš — to je mala, odvojena izmena u hosting
konfiguraciji.

## Poznata ograničenja

- Admin nalozi su u tabeli `admin_users` (vidi gore kako se dodaje drugi).
- Format datuma u poljima za datum (npr. dd.mm.gggg ili mm/dd/gggg) zavisi
  od jezika browsera/računara, ne od sajta.
- `/admin.html` je tehnički dostupan svakome ko zna URL, ali bez prijave ne
  vidi nijedan podatak (zaštita je na nivou baze — RLS — ne na tajnosti URL-a),
  što je standardan i bezbedan pristup za ovakve admin stranice.
