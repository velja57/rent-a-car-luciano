// Flota za stranicu /vozila, stranice pojedinačnih vozila i izdvojena vozila
// na početnoj. Golf i Audi su stvarna vozila klijenta i preuzimaju se iz
// cars.js (isti id = ista provera zauzetosti kao u hero sekciji). Ostalih 10
// su modeli koji se najčešće pojavljuju u ponudi rent-a-car agencija u
// Beogradu — PRIVREMENO, dok klijent ne pošalje prava vozila i fotografije.
//
// CENE (pricePerDay = osnovna cena za 1–2 dana): prosek javno objavljenih
// cenovnika beogradskih agencija (Carwiz, Rent a Car Menadžer, Atos, Benicassim
// Cars, Dvorac, Arrentacar, Rent a Car Serbia, MMS AutoRent, Beograd77, Galaxy
// Pro, Nova Rent — oktobar 2026). Kod tabela po dužini najma uzeta je cena za
// najam od 3 dana, sa PDV-om; kod "već od" cena uzeta je objavljena cena.
// Popusti za duži najam su u src/data/rental.js.
//
// deposit: null = bez depozita; broj = iznos u evrima (samo premium i kombi).
// type: grupa za filter na stranici /vozila (vidi VEHICLE_TYPES).
// featured: prikazuje se na početnoj; recommended: oznaka "Preporuka".
//
// Fotografije: Wikimedia Commons (slobodne licence). Autor i licenca MORAJU
// ostati navedeni uz sliku (prikazuju se ispod galerije vozila).

import { cars } from './cars';

export const VEHICLE_TYPES = [
  { id: 'mali', label: 'Gradski' },
  { id: 'srednji', label: 'Kompakt i limuzine' },
  { id: 'suv', label: 'SUV i crossover' },
  { id: 'premium', label: 'Premium' },
  { id: 'kombi', label: 'Kombi' },
];

const COMMONS = 'https://commons.wikimedia.org/wiki/File:';

const RENTAL_TERMS = {
  mileage: 'Neograničena kilometraža',
  cancellation: 'Besplatno otkazivanje do 48h pre preuzimanja',
};

function photo(carId, n, alt, author, license, file, focus) {
  return {
    src: `/fleet/${carId}/${n}.jpg`,
    thumb: `/fleet/${carId}/${n}-sm.jpg`,
    alt,
    focus,
    credit: { author, license, url: COMMONS + file },
  };
}

function heroCar(id) {
  const { framesDir: _framesDir, frameCount: _frameCount, ...car } = cars.find((c) => c.id === id);
  return car;
}

export const fleet = [
  {
    id: 'fiat-500',
    name: 'Fiat 500 Hybrid',
    category: 'Gradski',
    type: 'mali',
    featured: true,
    year: 2023,
    engine: '1.0 Hybrid',
    power: 70,
    transmission: 'Manuelni',
    fuel: 'Hibrid (benzin)',
    drive: 'Prednji',
    consumption: '≈ 5,3 l/100 km',
    seats: 4,
    doors: 3,
    trunk: 185,
    luggage: '1 veliki + 1 mali kofer',
    minAge: 18,
    deposit: null,
    pricePerDay: 21,
    ...RENTAL_TERMS,
    description:
      'Ikonični italijanski gradski automobil sa blagim hibridnim pogonom. Kompaktne dimenzije i mala potrošnja čine ga idealnim za gužvu i parkiranje u centru grada.',
    features: ['Osiguranje uključeno', 'Klima uređaj', 'Bluetooth', 'Android Auto / CarPlay', 'Start/Stop sistem', 'Senzori za parkiranje'],
    images: [
      photo('fiat-500', 1, 'Fiat 500 Hybrid — spreda', 'M 93', 'CC BY-SA 3.0 DE', 'Fiat_500_1.0_GSE_Hybrid_(Facelift)_%E2%80%93_f_22062025.jpg'),
      photo('fiat-500', 2, 'Fiat 500 Hybrid — pozadi', 'M 93', 'CC BY-SA 3.0 DE', 'Fiat_500_1.0_GSE_Hybrid_(Facelift)_%E2%80%93_h_22062025.jpg'),
      photo('fiat-500', 3, 'Fiat 500 — enterijer', 'Petar Milošević', 'CC BY-SA 4.0', 'Fiat_500_dashboard_(white).jpg'),
    ],
  },
  {
    id: 'renault-clio',
    name: 'Renault Clio',
    category: 'Ekonomična',
    type: 'mali',
    year: 2024,
    engine: '1.0 TCe',
    power: 90,
    transmission: 'Manuelni',
    fuel: 'Benzin',
    drive: 'Prednji',
    consumption: '≈ 5,4 l/100 km',
    seats: 5,
    doors: 5,
    trunk: 391,
    luggage: '2 velika kofera',
    minAge: 18,
    deposit: null,
    pricePerDay: 37,
    ...RENTAL_TERMS,
    description:
      'Najprodavaniji mali automobil Evrope u najnovijem izdanju. Prostran za svoju klasu, štedljiv i lak za vožnju — pouzdan izbor i za grad i za duže relacije.',
    features: ['Osiguranje uključeno', 'Klima uređaj', 'LED farovi', 'Bluetooth', 'Android Auto / CarPlay', 'Tempomat', 'Senzori za parkiranje'],
    images: [
      photo('renault-clio', 1, 'Renault Clio — spreda', 'M 93', 'CC BY-SA 3.0 DE', 'Renault_Clio_Evolution_(V,_Facelift)_%E2%80%93_f_04042026.jpg', '80% 50%'),
      photo('renault-clio', 2, 'Renault Clio — pozadi', 'M 93', 'CC BY-SA 3.0 DE', 'Renault_Clio_Evolution_(V,_Facelift)_%E2%80%93_h_04042026.jpg'),
    ],
  },
  {
    id: 'toyota-yaris-cross',
    name: 'Toyota Yaris Cross Hybrid',
    category: 'Crossover',
    type: 'suv',
    recommended: true,
    year: 2023,
    engine: '1.5 Hybrid',
    power: 116,
    transmission: 'Automatik',
    fuel: 'Hibrid (benzin)',
    drive: 'Prednji',
    consumption: '≈ 4,6 l/100 km',
    seats: 5,
    doors: 5,
    trunk: 397,
    luggage: '2 velika kofera',
    minAge: 18,
    deposit: null,
    pricePerDay: 38,
    ...RENTAL_TERMS,
    description:
      'Kompaktni crossover sa punim hibridnim pogonom i automatskim menjačem. Povišena pozicija za vožnju, tiha vožnja kroz grad i izuzetno niska potrošnja.',
    features: ['Osiguranje uključeno', 'Automatska klima', 'Kamera za vožnju unazad', 'Adaptivni tempomat', 'Asistent za održavanje trake', 'Android Auto / CarPlay'],
    images: [
      photo('toyota-yaris-cross', 1, 'Toyota Yaris Cross — spreda', 'Alexander-93', 'CC BY-SA 4.0', 'Toyota_Yaris_Cross_Hybrid_(XP210)_1X7A1846.jpg'),
      photo('toyota-yaris-cross', 2, 'Toyota Yaris Cross — pozadi', 'Alexander-93', 'CC BY-SA 4.0', 'Toyota_Yaris_Cross_Hybrid_(XP210)_1X7A1848.jpg'),
      photo('toyota-yaris-cross', 3, 'Toyota Yaris Cross — enterijer', 'Alexander Migl', 'CC BY-SA 4.0', 'Toyota_Yaris_Cross_Hybrid_Leonberg_2022_1X7A0555.jpg'),
    ],
  },
  {
    id: 'toyota-corolla',
    name: 'Toyota Corolla Sedan Hybrid',
    category: 'Limuzina',
    type: 'srednji',
    year: 2023,
    engine: '1.8 Hybrid',
    power: 140,
    transmission: 'Automatik',
    fuel: 'Hibrid (benzin)',
    drive: 'Prednji',
    consumption: '≈ 4,5 l/100 km',
    seats: 5,
    doors: 4,
    trunk: 471,
    luggage: '3 velika kofera',
    minAge: 18,
    deposit: null,
    pricePerDay: 43,
    ...RENTAL_TERMS,
    description:
      'Najprodavaniji automobil na svetu u elegantnoj limuzinskoj verziji. Hibridni pogon, automatik i prostran prtljažnik za udobna putovanja bez razmišljanja o potrošnji.',
    features: ['Osiguranje uključeno', 'Automatska klima', 'Kamera za vožnju unazad', 'Adaptivni tempomat', 'Asistent za održavanje trake', 'Android Auto / CarPlay'],
    images: [
      photo('toyota-corolla', 1, 'Toyota Corolla Sedan — spreda', 'Alexander Migl', 'CC BY-SA 4.0', 'Toyota_Corolla_Limousine_Hybrid_Genf_2019_1Y7A5576.jpg'),
      photo('toyota-corolla', 2, 'Toyota Corolla Sedan — pozadi', 'Alexander Migl', 'CC BY-SA 4.0', 'Toyota_Corolla_Limousine_Hybrid_Genf_2019_1Y7A5582.jpg'),
    ],
  },
  {
    id: 'skoda-octavia',
    name: 'Škoda Octavia',
    category: 'Kompakt',
    type: 'srednji',
    featured: true,
    recommended: true,
    year: 2024,
    engine: '2.0 TDI',
    power: 150,
    transmission: 'Automatik',
    fuel: 'Dizel',
    drive: 'Prednji',
    consumption: '≈ 4,7 l/100 km',
    seats: 5,
    doors: 5,
    trunk: 600,
    luggage: '3 velika kofera',
    minAge: 18,
    deposit: null,
    pricePerDay: 44,
    ...RENTAL_TERMS,
    description:
      'Najtraženiji automobil u rent-a-car ponudi Srbije. Ogroman prtljažnik od 600 litara, štedljiv dizel i DSG menjač — savršen spoj prostora i ekonomičnosti.',
    features: ['Osiguranje uključeno', 'Automatska klima', 'Navigacija', 'Digitalni kokpit', 'Android Auto / CarPlay', 'Tempomat', 'Senzori za parkiranje'],
    images: [
      photo('skoda-octavia', 1, 'Škoda Octavia — spreda', 'LuvsMG481', 'CC BY-SA 4.0', '2024_Skoda_Octavia_110TSI_Select_front.jpg', '100% 50%'),
      photo('skoda-octavia', 2, 'Škoda Octavia — pozadi', 'LuvsMG481', 'CC BY-SA 4.0', '2024_Skoda_Octavia_110TSI_Select_rear.jpg', '30% 50%'),
      photo('skoda-octavia', 3, 'Škoda Octavia — enterijer', 'Mike-fiesta', 'CC BY-SA 4.0', 'Skoda_Octavia_IV_interior.jpg'),
    ],
  },
  {
    id: 'dacia-duster',
    name: 'Dacia Duster 4x4',
    category: 'SUV',
    type: 'suv',
    year: 2023,
    engine: '1.5 Blue dCi',
    power: 115,
    transmission: 'Manuelni',
    fuel: 'Dizel',
    drive: '4x4',
    consumption: '≈ 5,5 l/100 km',
    seats: 5,
    doors: 5,
    trunk: 411,
    luggage: '2 velika kofera',
    minAge: 18,
    deposit: null,
    pricePerDay: 48,
    ...RENTAL_TERMS,
    description:
      'Robustan SUV sa pogonom na sva četiri točka i povišenim klirensom. Pravi izbor za planine, sneg i makadam, uz štedljiv dizel motor.',
    features: ['Osiguranje uključeno', 'Pogon 4x4', 'Klima uređaj', 'Bluetooth', 'Android Auto / CarPlay', 'Tempomat', 'Senzori za parkiranje'],
    images: [
      photo('dacia-duster', 1, 'Dacia Duster — spreda', 'Alexander Migl', 'CC BY-SA 4.0', 'Dacia_Duster_II_Facelift_IMG_6331.jpg'),
      photo('dacia-duster', 2, 'Dacia Duster — pozadi', 'Alexander Migl', 'CC BY-SA 4.0', 'Dacia_Duster_II_Facelift_IMG_6233.jpg'),
      photo('dacia-duster', 3, 'Dacia Duster — bočno', 'Alexander Migl', 'CC BY-SA 4.0', 'Dacia_Duster_II_Facelift_IAA_2021_1X7A0133.jpg'),
    ],
  },
  {
    id: 'kia-sportage',
    name: 'Kia Sportage',
    category: 'SUV',
    type: 'suv',
    featured: true,
    recommended: true,
    year: 2025,
    engine: '1.6 T-GDi MHEV',
    power: 150,
    transmission: 'Automatik',
    fuel: 'Benzin (mild hibrid)',
    drive: 'Prednji',
    consumption: '≈ 6,7 l/100 km',
    seats: 5,
    doors: 5,
    trunk: 591,
    luggage: '3 velika kofera',
    minAge: 18,
    deposit: null,
    pricePerDay: 53,
    ...RENTAL_TERMS,
    description:
      'Moderan porodični SUV najnovije generacije sa futurističkim dizajnom i zakrivljenim panoramskim ekranom. Prostran, tih i bogato opremljen za duga putovanja.',
    features: ['Osiguranje uključeno', 'Dvozonska automatska klima', 'Navigacija', 'Panoramski ekran', 'Kamera za vožnju unazad', 'Adaptivni tempomat', 'Grejanje sedišta'],
    images: [
      photo('kia-sportage', 1, 'Kia Sportage — spreda', 'Alexander Migl', 'CC BY-SA 4.0', '2025_Kia_Sportage_(NQ5)_Automesse_Ludwigsburg_2025_DSC_2532.jpg'),
      photo('kia-sportage', 2, 'Kia Sportage — pozadi', 'Alexander Migl', 'CC BY-SA 4.0', '2025_Kia_Sportage_(NQ5)_Automesse_Ludwigsburg_2025_DSC_2539.jpg'),
      photo('kia-sportage', 3, 'Kia Sportage — enterijer', 'Alexander Migl', 'CC BY-SA 4.0', '2025_Kia_Sportage_(NQ5)_autoMOBIL_T%C3%BCbingen_2025_DSC_2798.jpg'),
    ],
  },
  {
    // Motor i snaga su pretpostavka (2.0 TDI, 116 KS) — potvrdi sa klijentom.
    ...heroCar('golf'),
    type: 'srednji',
    recommended: true,
    engine: '2.0 TDI',
    power: 116,
    drive: 'Prednji',
    consumption: '≈ 4,8 l/100 km',
    trunk: 381,
    images: [
      photo('golf', 1, 'Volkswagen Golf 8 — spreda', 'Alexander-93', 'CC BY-SA 4.0', 'Volkswagen_Golf_VIII_Facelift_IMG_9440.jpg'),
      photo('golf', 2, 'Volkswagen Golf 8 — pozadi', 'Alexander-93', 'CC BY-SA 4.0', 'Volkswagen_Golf_VIII_Facelift_IMG_9457.jpg'),
      photo('golf', 3, 'Volkswagen Golf 8 — spreda, bočno', 'Alexander-93', 'CC BY-SA 4.0', 'Volkswagen_Golf_VIII_Facelift_IMG_9913.jpg'),
    ],
  },
  {
    id: 'bmw-serija-3',
    name: 'BMW Serija 3 — 320d',
    category: 'Premium',
    type: 'premium',
    featured: true,
    year: 2023,
    engine: '2.0 Diesel (320d)',
    power: 190,
    transmission: 'Automatik',
    fuel: 'Dizel (mild hibrid)',
    drive: 'Zadnji',
    consumption: '≈ 4,9 l/100 km',
    seats: 5,
    doors: 4,
    trunk: 480,
    luggage: '3 velika kofera',
    minAge: 21,
    deposit: 300,
    pricePerDay: 57,
    ...RENTAL_TERMS,
    description:
      'Referentna sportska limuzina premium klase. Snažan i štedljiv dizel, osmostepeni automatik i zadnji pogon za vožnju koja se pamti — idealan za poslovna putovanja.',
    features: ['Osiguranje uključeno', 'Automatska klima', 'Navigacija', 'Kožna sedišta', 'Grejanje sedišta', 'Kamera za vožnju unazad', 'Tempomat', 'Ambijentalno osvetljenje'],
    images: [
      photo('bmw-serija-3', 1, 'BMW Serija 3 — spreda', 'Alexander Migl', 'CC BY-SA 4.0', 'BMW_G20_(2022)_1X7A6120.jpg', '85% 50%'),
      photo('bmw-serija-3', 2, 'BMW Serija 3 — pozadi', 'Alexander Migl', 'CC BY-SA 4.0', 'BMW_G20_(2022)_1X7A6118.jpg'),
      photo('bmw-serija-3', 3, 'BMW Serija 3 — enterijer', 'Damian B Oh', 'CC BY-SA 4.0', 'BMW_G20_LCI_Sensatec_Perforated_Cognac_(1).jpg'),
    ],
  },
  {
    // Motor i snaga su pretpostavka (35 TDI, 163 KS) — potvrdi sa klijentom.
    ...heroCar('audi'),
    type: 'premium',
    engine: '2.0 TDI (35 TDI)',
    power: 163,
    drive: 'Prednji',
    consumption: '≈ 5,0 l/100 km',
    trunk: 465,
    images: [
      photo('audi', 1, 'Audi A5 Sportback — spreda', 'Alexander Migl', 'CC BY-SA 4.0', 'Audi_A5_Sportback_F5_IMG_2835.jpg'),
      photo('audi', 2, 'Audi A5 Sportback — pozadi', 'Alexander-93', 'CC BY-SA 4.0', 'Audi_A5_Sportback_F5_FL_1X7A7086.jpg'),
      photo('audi', 3, 'Audi A5 Sportback — spreda, bočno', 'Alexander Migl', 'CC BY-SA 4.0', 'Audi_A5_Sportback_F5_FL_IMG_6127.jpg'),
    ],
  },
  {
    id: 'skoda-superb',
    name: 'Škoda Superb',
    category: 'Poslovna',
    type: 'srednji',
    year: 2024,
    engine: '2.0 TDI',
    power: 150,
    transmission: 'Automatik',
    fuel: 'Dizel',
    drive: 'Prednji',
    consumption: '≈ 5,1 l/100 km',
    seats: 5,
    doors: 5,
    trunk: 645,
    luggage: '4 velika kofera',
    minAge: 18,
    deposit: null,
    pricePerDay: 61,
    ...RENTAL_TERMS,
    description:
      'Nova generacija velike poslovne limuzine sa izuzetnim prostorom za noge pozadi i prtljažnikom od 645 litara. Vrhunski komfor za službena putovanja i transfere.',
    features: ['Osiguranje uključeno', 'Trozonska automatska klima', 'Navigacija', 'Digitalni kokpit', 'Adaptivni tempomat', 'Kamera za vožnju unazad', 'Grejanje sedišta', 'Električni prtljažnik'],
    images: [
      photo('skoda-superb', 1, 'Škoda Superb — spreda', 'M 93', 'CC BY-SA 3.0 DE', 'Skoda_Superb_L%26K_(IV)_%E2%80%93_f_12042026.jpg', '10% 50%'),
      photo('skoda-superb', 2, 'Škoda Superb — pozadi', 'M 93', 'CC BY-SA 3.0 DE', 'Skoda_Superb_L%26K_(IV)_%E2%80%93_h_12042026.jpg'),
      photo('skoda-superb', 3, 'Škoda Superb — enterijer', 'Alexander-93', 'CC BY-SA 4.0', '%C5%A0koda_Superb_IV_Combi_Leonberg_2024_IMG_1087.jpg'),
    ],
  },
  {
    id: 'renault-trafic',
    name: 'Renault Trafic 8+1',
    category: 'Kombi',
    type: 'kombi',
    year: 2023,
    engine: '2.0 Blue dCi',
    power: 150,
    transmission: 'Automatik',
    fuel: 'Dizel',
    drive: 'Prednji',
    consumption: '≈ 7,7 l/100 km',
    seats: 9,
    doors: 4,
    trunk: 1000,
    luggage: '8–9 putnih torbi',
    minAge: 21,
    deposit: 300,
    pricePerDay: 70,
    ...RENTAL_TERMS,
    description:
      'Putnički kombi sa 9 sedišta za grupe, porodice i sportske ekipe. Automatski menjač i ekonomičan dizel čine i duga putovanja lakim — jedno vozilo za celo društvo.',
    features: ['Osiguranje uključeno', '9 sedišta', 'Klima uređaj', 'Bluetooth', 'Android Auto / CarPlay', 'Tempomat', 'Senzori za parkiranje'],
    images: [
      photo('renault-trafic', 1, 'Renault Trafic — spreda', 'Alexander-93', 'CC BY-SA 4.0', 'Renault_Trafic_III_buses_Facelift_IMG_7691_(cropped).jpg'),
      photo('renault-trafic', 2, 'Renault Trafic — pozadi', 'Alexander-93', 'CC BY-SA 4.0', 'Renault_Trafic_III_buses_Facelift_1X7A7456_(cropped).jpg'),
      photo('renault-trafic', 3, 'Renault Trafic — enterijer', 'Crazy1880', 'CC BY-SA 4.0', '2023-02-03_Renault_Trafic_Interior.jpg'),
    ],
  },
];

export const MAX_POWER = Math.max(...fleet.map((c) => c.power));

// "Dizel (mild hibrid)" -> "Dizel" — za kartice i filter goriva.
export function fuelKind(car) {
  return car.fuel.split(' (')[0];
}
