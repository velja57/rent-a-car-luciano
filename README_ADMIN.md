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

## Kad sajt bude hostovan

Admin panel će biti dostupan na `<tvoj-domen>/admin.html`. Kad budemo radili
hosting (Vercel), mogu da podesim i da radi na lepšem `/admin` umesto
`/admin.html`, ako želiš — to je mala, odvojena izmena u hosting
konfiguraciji.

## Poznata ograničenja

- Samo jedan admin nalog je predviđen u ovoj fazi (SQL politika proverava
  tačno JEDAN email). Ako kasnije zatrebaju dva naloga (npr. zaposleni),
  to je mala izmena — javi.
- Nema izmene drugih podataka rezervacije (ime, datumi...) iz admin panela,
  samo otkazivanje — nije traženo u ovoj fazi.
- Nema paginacije — ako broj rezervacija jednog dana postane veliki (stotine),
  vredi dodati, ali za sada nije potrebno.
- `/admin.html` je tehnički dostupan svakome ko zna URL, ali bez prijave ne
  vidi nijedan podatak (zaštita je na nivou baze — RLS — ne na tajnosti URL-a),
  što je standardan i bezbedan pristup za ovakve admin stranice.
