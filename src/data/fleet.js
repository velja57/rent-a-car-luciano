// Vozni park Luciano Rent a Car — stvarna vozila (8). Odavde čitaju Hero pretraga,
// stranica /vozila, stranice pojedinačnih vozila, forma za rezervaciju, uslovi
// najma i admin panel.
//
// id je i adresa stranice vozila (/vozila/<id>) i car_id u bazi (rezervacije,
// cenovnik, registarske oznake) — ne menjati ga kad vozilo već ima rezervacije.
//
// CENE (pricePerDay = osnovna cena za 1–2 dana): početne vrednosti, iste kao u
// supabase/schema.sql (price_list). Važeće cene su u bazi — admin ih menja u
// admin panelu (Vozila), a sajt ih učitava preko src/lib/priceList.js.
// Popusti za duži najam su u src/data/rental.js.
//
// Snagu i opremu je klijent potvrdio (13. 11. 2026); potrošnja je približna
// vrednost za taj motor.
//
// deposit: null = bez depozita; broj = iznos u evrima.
// type: grupa za filter na stranici /vozila (vidi VEHICLE_TYPES).
// en.description: opis na engleskom (ostale vrednosti prevodi src/i18n/en.js, carValues).
// recommended: oznaka "Preporuka".
//
// Fotografije: Wikimedia Commons (slobodne licence) — tačan model i generacija,
// boja nije nužno ista kao kod naših vozila. Autor i licenca MORAJU ostati
// navedeni uz sliku (prikazuju se ispod galerije vozila).

// Nazivi tipova su u rečnicima (src/i18n, types).
export const VEHICLE_TYPES = ['mali', 'srednji', 'suv', 'premium'];

const COMMONS = 'https://commons.wikimedia.org/wiki/File:';

const RENTAL_TERMS = {
  mileage: 'Neograničena kilometraža',
  cancellation: 'Besplatno otkazivanje do 48h pre preuzimanja',
};

// Standardna oprema (Fabia, obe Ibize, Golf 7) — automatska klima je u svim vozilima.
const STANDARD_FEATURES = ['Osiguranje uključeno', 'Automatska klima', 'Centralno zaključavanje', 'Električni podizači stakala'];

// view: front | rear | interior | side | front-side — opis slike se pravi iz
// naziva vozila i prevoda ugla (src/i18n, views).
function photo(carId, n, view, author, license, file, focus) {
  return {
    src: `/fleet/${carId}/${n}.jpg`,
    thumb: `/fleet/${carId}/${n}-sm.jpg`,
    view,
    focus,
    credit: { author, license, url: COMMONS + file },
  };
}

export const fleet = [
  {
    id: 'skoda-fabia',
    name: 'Škoda Fabia',
    category: 'Gradski',
    type: 'mali',
    year: 2016,
    engine: '1.0 MPI',
    power: 75,
    transmission: 'Manuelni',
    fuel: 'Benzin',
    drive: 'Prednji',
    consumption: '≈ 5,0 l/100 km',
    seats: 5,
    doors: 5,
    trunk: 330,
    luggage: '1 veliki + 2 mala kofera',
    minAge: 18,
    deposit: null,
    pricePerDay: 25,
    ...RENTAL_TERMS,
    description:
      'Pouzdan i štedljiv gradski hečbek koji se lako parkira i malo troši. Pametan izbor za svakodnevne vožnje po Beogradu po najpovoljnijoj ceni.',
    en: {
      description:
        'A reliable, economical city hatchback that is easy to park and light on fuel. The smart choice for everyday driving around Belgrade at the best price.',
    },
    features: STANDARD_FEATURES,
    images: [
      photo('skoda-fabia', 1, 'front', 'M 93', 'CC BY-SA 3.0 DE', 'Skoda_Fabia_Style_(III)_%E2%80%93_Frontansicht,_2._Mai_2015,_D%C3%BCsseldorf.jpg', '75% 50%'),
      photo('skoda-fabia', 2, 'rear', 'M 93', 'CC BY-SA 3.0 DE', 'Skoda_Fabia_Style_(III)_%E2%80%93_Heckansicht,_2._Mai_2015,_D%C3%BCsseldorf.jpg'),
      photo('skoda-fabia', 3, 'interior', 'Rozcestnik.sk', 'CC BY-SA 4.0', 'Fabia_III_interior.JPG'),
    ],
  },
  {
    id: 'seat-ibiza-benzin',
    name: 'Seat Ibiza 1.0 TSI',
    category: 'Gradski',
    type: 'mali',
    year: 2021,
    engine: '1.0 TSI',
    power: 95,
    transmission: 'Manuelni',
    fuel: 'Benzin',
    drive: 'Prednji',
    consumption: '≈ 5,3 l/100 km',
    seats: 5,
    doors: 5,
    trunk: 355,
    luggage: '2 velika kofera',
    minAge: 18,
    deposit: null,
    pricePerDay: 30,
    ...RENTAL_TERMS,
    description:
      'Moderan i okretan gradski automobil sa živahnim benzinskim motorom. Prostran za svoju klasu i prijatan za vožnju — odličan za grad i kraće izlete.',
    en: {
      description:
        'A modern, agile city car with a lively petrol engine. Roomy for its class and pleasant to drive — great for the city and short trips.',
    },
    features: STANDARD_FEATURES,
    images: [
      photo('seat-ibiza-benzin', 1, 'front', 'Vauxford', 'CC BY-SA 4.0', '2018_SEAT_Ibiza_SE_Technology_MPi_1.0_Front.jpg'),
      photo('seat-ibiza-benzin', 2, 'rear', 'Vauxford', 'CC BY-SA 4.0', '2018_SEAT_Ibiza_SE_Technology_MPi_1.0_Rear.jpg'),
    ],
  },
  {
    id: 'seat-ibiza-dizel',
    name: 'Seat Ibiza 1.6 TDI',
    category: 'Ekonomična',
    type: 'mali',
    year: 2021,
    engine: '1.6 TDI',
    power: 95,
    transmission: 'Manuelni',
    fuel: 'Dizel',
    drive: 'Prednji',
    consumption: '≈ 4,5 l/100 km',
    seats: 5,
    doors: 5,
    trunk: 355,
    luggage: '2 velika kofera',
    minAge: 18,
    deposit: null,
    pricePerDay: 32,
    ...RENTAL_TERMS,
    description:
      'Moderna Ibiza sa štedljivim dizel motorom — idealna kada planiraš više kilometara. Mala potrošnja i udobna vožnja i na dužim relacijama.',
    en: {
      description:
        'The modern Ibiza with an economical diesel engine — ideal when you plan to cover more miles. Low fuel consumption and a comfortable ride on longer trips too.',
    },
    features: STANDARD_FEATURES,
    images: [
      photo('seat-ibiza-dizel', 1, 'front', 'Alexander Migl', 'CC BY-SA 4.0', 'Seat_Ibiza_6F_IMG_3967.jpg'),
      photo('seat-ibiza-dizel', 2, 'rear', 'Alexander Migl', 'CC BY-SA 4.0', 'Seat_Ibiza_6F_IMG_3968.jpg'),
      photo('seat-ibiza-dizel', 3, 'interior', 'GalacticCuriosity', 'CC BY-SA 4.0', 'Seat_Ibiza_FR_Business_intense_(2018)_interior.jpg'),
    ],
  },
  {
    id: 'vw-golf-7',
    name: 'Volkswagen Golf 7',
    category: 'Kompakt',
    type: 'srednji',
    year: 2015,
    engine: '1.6 TDI',
    power: 110,
    transmission: 'Manuelni',
    fuel: 'Dizel',
    drive: 'Prednji',
    consumption: '≈ 4,5 l/100 km',
    seats: 5,
    doors: 5,
    trunk: 380,
    luggage: '2 velika kofera',
    minAge: 18,
    deposit: null,
    pricePerDay: 33,
    ...RENTAL_TERMS,
    description:
      'Legendarni Golf — prostran, tih i pouzdan, sa štedljivim dizel motorom. Proveren izbor za grad i putovanja kroz Srbiju.',
    en: {
      description:
        'The legendary Golf — roomy, quiet and reliable, with an economical diesel engine. A proven choice for the city and for trips across Serbia.',
    },
    features: STANDARD_FEATURES,
    images: [
      photo('vw-golf-7', 1, 'front', 'M 93', 'CC BY-SA 3.0 DE', 'VW_Golf_1.6_TDI_BlueMotion_Technology_Comfortline_(VII)_%E2%80%93_Frontansicht,_31._Dezember_2012,_D%C3%BCsseldorf.jpg', '95% 50%'),
      photo('vw-golf-7', 2, 'rear', 'M 93', 'CC BY-SA 3.0 DE', 'VW_Golf_1.6_TDI_BlueMotion_Technology_Comfortline_(VII)_%E2%80%93_Heckansicht,_31._Dezember_2012,_D%C3%BCsseldorf.jpg'),
      photo('vw-golf-7', 3, 'interior', 'Antoineets', 'CC BY-SA 4.0', 'Volkswagen_Golf_7_(before_facelift)_interior_-_GTD_version.jpg'),
    ],
  },
  {
    id: 'vw-golf-8',
    name: 'Volkswagen Golf 8',
    category: 'Kompakt',
    type: 'srednji',
    recommended: true,
    year: 2024,
    engine: '2.0 TDI',
    power: 150,
    transmission: 'Automatik',
    fuel: 'Dizel',
    drive: 'Prednji',
    consumption: '≈ 4,8 l/100 km',
    seats: 5,
    doors: 5,
    trunk: 381,
    luggage: '2 velika kofera',
    minAge: 18,
    deposit: null,
    pricePerDay: 55,
    ...RENTAL_TERMS,
    description:
      'Kompaktan hečbek najnovije generacije (2024), potpuno opremljen. Tih dizel motor i automatski menjač čine vožnju opuštenom u svakoj prilici.',
    en: {
      description:
        'A latest-generation (2024) compact hatchback, fully equipped. A quiet diesel engine and an automatic gearbox make every drive relaxed.',
    },
    features: [
      'Osiguranje uključeno',
      'Automatska klima',
      'Navigacija',
      'Bluetooth',
      'Tempomat',
      'Senzori za parkiranje',
      'Android Auto / CarPlay',
      'Kamera za vožnju unazad',
      'Grejanje sedišta',
    ],
    images: [
      photo('vw-golf-8', 1, 'front', 'Alexander-93', 'CC BY-SA 4.0', 'Volkswagen_Golf_VIII_Facelift_IMG_9440.jpg'),
      photo('vw-golf-8', 2, 'rear', 'Alexander-93', 'CC BY-SA 4.0', 'Volkswagen_Golf_VIII_Facelift_IMG_9457.jpg'),
      photo('vw-golf-8', 3, 'front-side', 'Alexander-93', 'CC BY-SA 4.0', 'Volkswagen_Golf_VIII_Facelift_IMG_9913.jpg'),
    ],
  },
  {
    id: 'vw-tiguan',
    name: 'Volkswagen Tiguan',
    category: 'SUV',
    type: 'suv',
    recommended: true,
    year: 2022,
    engine: '2.0 TDI',
    power: 150,
    transmission: 'Automatik',
    fuel: 'Dizel',
    drive: 'Prednji',
    consumption: '≈ 5,9 l/100 km',
    seats: 5,
    doors: 5,
    trunk: 615,
    luggage: '4 velika kofera',
    minAge: 21,
    deposit: null,
    pricePerDay: 58,
    ...RENTAL_TERMS,
    description:
      'Prostrani porodični SUV sa automatskim menjačem, povišenom pozicijom za vožnju i prtljažnikom od 615 litara. Bogata oprema za udobna putovanja sa celom porodicom.',
    en: {
      description:
        'A spacious family SUV with an automatic gearbox, a higher driving position and a 615-litre boot. Rich equipment for comfortable trips with the whole family.',
    },
    features: [
      'Osiguranje uključeno',
      'Automatska klima',
      'Navigacija',
      'Digitalni kokpit',
      'Android Auto / CarPlay',
      'Adaptivni tempomat',
      'Senzori za parkiranje',
      'Kamera za vožnju unazad',
      'LED farovi',
    ],
    images: [
      photo('vw-tiguan', 1, 'front', 'M 93', 'CC BY-SA 3.0 DE', 'VW_Tiguan_Life_(II,_Facelift)_%E2%80%93_f_03012021.jpg'),
      photo('vw-tiguan', 2, 'rear', 'M 93', 'CC BY-SA 3.0 DE', 'VW_Tiguan_Life_(II,_Facelift)_%E2%80%93_h_03012021.jpg'),
    ],
  },
  {
    id: 'volvo-v60',
    name: 'Volvo V60',
    category: 'Karavan',
    type: 'premium',
    year: 2022,
    engine: '2.0 B4',
    power: 197,
    transmission: 'Automatik',
    fuel: 'Dizel (mild hibrid)',
    drive: 'Prednji',
    consumption: '≈ 5,1 l/100 km',
    seats: 5,
    doors: 5,
    trunk: 529,
    luggage: '3 velika kofera',
    minAge: 21,
    deposit: null,
    pricePerDay: 62,
    ...RENTAL_TERMS,
    description:
      'Elegantan švedski karavan premium klase, poznat po vrhunskoj bezbednosti, sa prtljažnikom od 529 litara. Automatski menjač i bogata oprema za opuštena duga putovanja.',
    en: {
      description:
        'An elegant Swedish premium estate, renowned for top-class safety, with a 529-litre boot. An automatic gearbox and rich equipment for relaxed long journeys.',
    },
    features: [
      'Osiguranje uključeno',
      'Automatska klima',
      'Navigacija',
      'Digitalni kokpit',
      'Android Auto / CarPlay',
      'Tempomat',
      'Senzori za parkiranje',
      'LED farovi',
    ],
    images: [
      photo('volvo-v60', 1, 'front', 'Elise240SX', 'CC BY-SA 4.0', '2020_Volvo_V60_R-Design_in_Bursting_Blue_Metallic,_front_right,_2024-10-03.jpg', '80% 50%'),
      photo('volvo-v60', 2, 'rear', 'Elise240SX', 'CC BY-SA 4.0', '2020_Volvo_V60_R-Design_in_Bursting_Blue_Metallic,_rear_right,_2024-10-03.jpg'),
      photo('volvo-v60', 3, 'interior', 'MichalPL', 'CC BY-SA 4.0', 'Volvo_V60_Cross_Country_(SPA),_interior_in_Katowice,_Silesian_Voivodeship,_Poland,_March_2019.jpg'),
    ],
  },
  {
    id: 'audi-a6',
    name: 'Audi A6',
    category: 'Premium',
    type: 'premium',
    year: 2022,
    engine: '2.0 TDI (40 TDI)',
    power: 204,
    transmission: 'Automatik',
    fuel: 'Dizel (mild hibrid)',
    drive: 'Prednji',
    consumption: '≈ 5,3 l/100 km',
    seats: 5,
    doors: 4,
    trunk: 530,
    luggage: '3 velika kofera',
    minAge: 21,
    deposit: null,
    pricePerDay: 68,
    ...RENTAL_TERMS,
    description:
      'Poslovna limuzina premium klase sa automatskim menjačem i bogatom opremom. Tiha, prostrana i reprezentativna — za poslovne sastanke, transfere i posebne prilike.',
    en: {
      description:
        'A premium business sedan with an automatic gearbox and rich equipment. Quiet, spacious and prestigious — for business meetings, transfers and special occasions.',
    },
    features: [
      'Osiguranje uključeno',
      'Automatska klima',
      'Navigacija',
      'Digitalni kokpit',
      'Android Auto / CarPlay',
      'Tempomat',
      'Senzori za parkiranje',
      'LED farovi',
      'Ambijentalno osvetljenje',
    ],
    images: [
      photo('audi-a6', 1, 'front', 'Alexander-93', 'CC BY-SA 4.0', 'Audi_A6_C8_IMG_0079.jpg'),
      photo('audi-a6', 2, 'rear', 'Alexander-93', 'CC BY-SA 4.0', 'Audi_A6_C8_IMG_0081.jpg'),
      photo('audi-a6', 3, 'interior', 'Matti Blume', 'CC BY-SA 4.0', 'Audi_A6,_GIMS_2018,_Le_Grand-Saconnex_(1X7A1762).jpg'),
    ],
  },
];

export const MAX_POWER = Math.max(...fleet.map((c) => c.power));

// "Dizel (mild hibrid)" -> "Dizel" — za kartice i filter goriva.
export function fuelKind(car) {
  return car.fuel.split(' (')[0];
}
