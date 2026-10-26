# Hero sekcija — kako radi i kako je proširiti

## Kako radi video-mehanika

Umesto da se u browseru pušta/reversuje pravi `.mp4` (nepouzdano, browseri
ne podržavaju native reverse playback), svaki auto je pretvoren u sekvencu
JPEG frejmova (12 frejmova/sek, izvučeno iz originalnog 24fps videa) koja se
iscrtava na `<canvas>` preko `src/components/CarStage.jsx`.

- **Parkirano (idle):** iscrtava se frame `0000.jpg` statično.
- **Trenutni auto "odlazi":** frejmovi se puštaju napred, od 0 do poslednjeg.
- **Novi auto "dolazi":** frejmovi NOVOG auta se puštaju unazad, od
  poslednjeg do 0 — tako se sekvenca uvek vrati tačno na parkiranu pozu
  (frame 0), bez obzira koliko puta se auto menja.

Ovo znači da svaki auto treba SAMO jedan video klip koji počinje parkiran
i završava se "odlazi iz kadra" — isti klip se koristi i unazad i unapred.

## DomoAI watermark (uklonjen)

Oba videa (golf, audi) su iz besplatnog DomoAI tier-a i imaju watermark gore
levo (logo + natpis "DomoAI"). Frejmovi u `public/frames/` su već očišćeni
skriptom `scripts/watermark.py`, koja se uključuje opcijom `--bez-watermarka`:

```
python -I scripts/extract_sequence.py golf "Cars/ai-artwork-video_62d20f34-07a5-4a97-bf10-f611455e8fc4.mp4" --bez-watermarka
python -I scripts/extract_sequence.py audi "Cars/ai-artwork-video_7c81cdeb-f90e-413e-83a6-a694f06f396e.mp4" --bez-watermarka
```

Bez te opcije se dobijaju originalni frejmovi sa watermarkom.

- Natpis je poluprovidan (beli tekst + tamna senka), pa se matematički
  "skida" sa slike i ostaje prava pozadina.
- Logo je neproziran, pa se popunjava najsličnijim komadom pozadine iz istog
  ili susednog frejma, uz stapanje ivica.

Ograničenje: model watermarka (`scripts/domoai_watermark.npz`) važi samo za
DomoAI klipove 864x496 sa watermarkom na istom mestu. Za drugu rezoluciju
skripta prijavi grešku. Na par najtamnijih frejmova pred kraj golf odlaska
može da se nazire jedva vidljiv trag natpisa (pod tamnim gradijentom hero
sekcije praktično se ne vidi). Najčistije je i dalje generisati video bez
watermarka (plaćeni tier).

## Poznat problem sa trenutnim videima (golf, audi)

Ova dva videa (generisana u DomoAI) su sa **potpuno različitih lokacija**
Sajt radi ispravno funkcionalno, ali ulica vizuelno "skoči" pri promeni
auta dok se ne zamene boljim, usklađenim videima.

### Kako regenerisati video da ulica ostane ista

Isti princip kao za `AUTA/00_pozadina` folder sa foto-sekvencom (ranije
napravljeno na Desktopu): generiši JEDAN auto parkiran na ulici, pa taj
isti frame koristi kao "First Frame" (image-to-video) u DomoAI/Dreamini za
SVAKI sledeći auto — tako je pozadina identična, menja se samo auto.
Prompt: auto parkiran 1-2s, zatim kreće i odlazi niz ulicu, kamera statična
(bez pan/zoom), bez watermarka (plaćeni tier).

## Kako dodati bmw / merc

1. Ubaci novi `.mp4` u `Cars/` (ili bilo gde) — mora početi parkiran.
2. `pip install opencv-python-headless` (ako već nije instalirano), pa:
   ```
   python -I scripts/extract_sequence.py <id> "putanja/do/videa.mp4"
   ```
   Ovo izvuče 12fps JPEG sekvencu u `public/frames/<id>/` i ispiše koliko
   frejmova treba upisati u `frameCount`. Ako je video iz besplatnog DomoAI
   tier-a (sa watermarkom), dodaj `--bez-watermarka` na kraj komande.
3. Dodaj novi objekat u `src/data/cars.js`:
   ```js
   {
     id: 'bmw',
     name: '...',
     category: '...',
     transmission: '...',
     fuel: '...',
     seats: 5,
     pricePerDay: 0, // postavi pravu cenu
     framesDir: '/frames/bmw',
     frameCount: <broj izvučenih frejmova>,
   }
   ```
4. Ništa drugo ne treba menjati — `CarStage` i dropdown automatski
   rade sa svime što je u `cars.js`.

## Placeholder podaci

Cene i specifikacije u `src/data/cars.js` su izmišljene (placeholder) —
zameni ih stvarnim vrednostima.
