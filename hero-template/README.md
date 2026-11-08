# Hero template za rent-a-car sajtove

Kopija Hero sekcije sa sajta Luciano Rent a Car, nezavisna od tog sajta. Sadrži:

- pozadinu sa animacijom automobila (slike na `<canvas>`-u, odlazak i dolazak vozila);
- karticu za izbor vozila sa podacima i cenom;
- prozor „Više informacija o vozilu“;
- celu formu za rezervaciju (kalendar, vremena, dodaci, obračun cene, WhatsApp, poziv);
- zaglavlje koje stoji preko Hero sekcije (logo, meni, jezik, „Pozovi nas“, mobilni meni);
- srpski i engleski jezik.

## Ubacivanje u drugi projekat

Primer je za Vite + React (tako je i testirano).

1. Kopiraj ceo folder `hero-template` u `src/` novog projekta.
2. Kopiraj sadržaj foldera `hero-template/assets/frames/` u `public/frames/` novog projekta
   (dobija se `public/frames/golf/0000.jpg` itd.).
3. Ubaci sekciju na stranicu:

   ```jsx
   import HeroSection from './hero-template/HeroSection';

   export default function App() {
     return <HeroSection />;
   }
   ```

4. U CSS-u novog projekta stavi `body { margin: 0; }` i obriši početne stilove koje Vite
   napravi za `#root` (`max-width`, `padding`, `text-align`), da sekcija ide preko cele širine.
5. Preporuka, da prva slika stigne brže — u `<head>` u `index.html`:

   ```html
   <link rel="preload" as="image" href="/frames/golf/0000.jpg" fetchpriority="high" />
   ```

   Putanju promeni ako prvo vozilo nije Golf.

## Zavisnosti

| Paket | Potreban | Zašto |
|---|---|---|
| `react`, `react-dom` | da | Testirano na verziji 19. |
| `@supabase/supabase-js` | samo za online rezervacije | Vidi „Online rezervacije“. |

React Router, Tailwind i druge biblioteke nisu potrebni. Font Inter se učitava sam, preko
Google Fonts (`hero.css`), pa je za njega potreban internet.

## Šta se gde menja

| Šta | Gde |
|---|---|
| Naziv agencije | `hero.config.js` → `BRAND.name` i `BRAND.accent` |
| Logo kao slika | `hero.config.js` → `BRAND.logoImage` (npr. `'/logo.svg'`), `BRAND.logoAlt` |
| Telefon, WhatsApp, mejl, radno vreme | `hero.config.js`, odeljak „Kontakt“ i `BRAND.email` |
| Vozila, cene, slike vozila | `hero.config.js` → `cars` |
| Adrese linkova | `hero.config.js` → `PATHS` |
| Stavke menija | `hero.config.js` → `NAV_LINKS` |
| Broj u linku „Pogledaj svih 12 vozila“ | `hero.config.js` → `FLEET_COUNT` |
| Popusti, dodatne usluge, radni termini | `hero.config.js`, odeljak „Cene i pravila najma“ |
| Svi natpisi: naslov, tekstovi, dugmad | `i18n/sr.js` i `i18n/en.js` (`hero`, `nav`, `common`, `reservation`) |
| Podrazumevano mesto preuzimanja | `i18n/sr.js` i `i18n/en.js` → `reservation.defaultLocation` |
| Natpisi dodatnih usluga | `i18n/sr.js` i `i18n/en.js` → `extras` |
| Boje, zaobljenja | prvi blok u `hero.css` (`--color-accent` je zlatna boja) |
| Samo jedan jezik | `hero.config.js` → obriši drugi iz `LANGUAGES`; prekidač jezika nestaje |

Ako menjaš vozila na engleskom sajtu: kategorije, menjač, gorivo i oprema se prevode preko
`carValues` u `i18n/en.js`; vrednost koje tamo nema ostaje napisana kako je uneta.

## Fotografije automobila

Svako vozilo ima folder sa slikama `0000.jpg`, `0001.jpg`, … Slika `0000.jpg` je parkirano
vozilo. U `cars` se upisuju `framesDir` (npr. `'/frames/bmw'`) i `frameCount` (broj slika).
Ako se vozilo ne vidi, proveri da li su slike u `public/` i da li se tačno poklapaju naziv
foldera i broj slika.

**Obična fotografija, bez animacije:** jedna slika nazvana `0000.jpg` i `frameCount: 1`.
Vozilo se tada menja odmah, bez vožnje.

**Animacija od videa:** klip mora da počne sa parkiranim vozilom, a da se završi kad vozilo
ode iz kadra. Isti klip se koristi i unapred (odlazak) i unazad (dolazak).

```
pip install opencv-python-headless
python -I tools/extract_sequence.py bmw "putanja/do/videa.mp4"
```

Slike nastaju u `assets/frames/bmw/`, a alat ispiše broj koji se upisuje u `frameCount`.
Originalni klipovi Golfa i Audija su u `assets/source-video/`. Za te DomoAI klipove postoji
opcija `--bez-watermarka`, koja radi samo za klipove 864×496 sa watermarkom na istom mestu.

## Opcije komponente

```jsx
<HeroSection
  showHeader={false}                 // sajt već ima svoje zaglavlje
  supabase={supabaseClient}          // online rezervacije
  language={jezik}                   // jezik određuje sajt, npr. po adresi
  onLanguageChange={promeniJezik}
  renderLink={({ href, ...props }) => <Link to={href} {...props} />} // React Router, bez ponovnog učitavanja
/>
```

Nijedna opcija nije obavezna.

## Online rezervacije

Bez baze sve radi, a dugme forme šalje popunjenu rezervaciju preko WhatsApp-a. Sajt Luciano
koristi Supabase. Da bi i novi sajt primao rezervacije online:

1. Napravi Supabase projekat i u njemu funkcije `is_car_available`, `get_booked_dates`,
   `create_reservation` i `get_price_list` (nalaze se u `supabase/schema.sql` projekta Luciano;
   u tom fajlu zameni adresu administratora svojom).
2. Instaliraj `@supabase/supabase-js` i prosledi klijenta:

   ```jsx
   import { createClient } from '@supabase/supabase-js';

   const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

   <HeroSection supabase={supabase} />
   ```

Cene iz baze tada zamenjuju one iz `hero.config.js`. Mejlovi potvrde nisu deo ovog foldera:
to je zasebna Supabase funkcija `send-reservation-email`.

## Dobro je znati

- Stilovi važe samo unutar `.hero-tpl` i ne utiču na ostatak novog sajta.
- Klik na „Rezerviši odmah“ pokriva ceo ekran, a klik na „Više informacija“ prikazuje prozor
  unutar kartice. Tako radi i original.
- Linkovi menija (Vozila, Uslovi najma…) vode na stranice novog sajta; te stranice nisu deo
  templatea. Zato obavezno proveri `PATHS`.
- Glatko skrolovanje do delova stranice je podešavanje celog sajta: `html { scroll-behavior: smooth; }`.
- Testirano je sa Vite + React 19. Na drugim alatima (npr. Next.js) nije proveravano.
