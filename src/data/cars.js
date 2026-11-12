// Golf i Audi: stvarni podaci klijenta (Luciano Rent a Car).
// Depozit: null = bez depozita; broj = iznos u evrima. Dogovor: depozit samo
// za skuplja vozila (premium i kombi) — isto pravilo kao u src/data/fleet.js.
// BMW M5 i Mercedes-Benz C 300 su najavljeni, ali još nemaju video/slike —
// prikazuju se u dropdownu kao "Uskoro dostupno" i ne mogu se izabrati.
export const cars = [
  {
    id: 'golf',
    name: 'Volkswagen Golf 8',
    category: 'Kompakt',
    transmission: 'Automatik',
    fuel: 'Dizel',
    seats: 5,
    pricePerDay: 55,
    year: 2024,
    doors: 5,
    luggage: '2 velika kofera',
    mileage: 'Neograničena kilometraža',
    minAge: 18,
    deposit: null,
    cancellation: 'Besplatno otkazivanje do 48h pre preuzimanja',
    description:
      'Kompaktan hečbek najnovije generacije (2024), potpuno opremljen. Tih dizel motor i automatski menjač čine vožnju opuštenom u svakoj prilici.',
    en: {
      description:
        'A latest-generation (2024) compact hatchback, fully equipped. A quiet diesel engine and an automatic gearbox make every drive relaxed.',
    },
    features: [
      'Osiguranje uključeno',
      'Klima uređaj',
      'Navigacija',
      'Bluetooth',
      'Tempomat',
      'Senzori za parkiranje',
      'Android Auto / CarPlay',
      'Kamera za vožnju unazad',
      'Grejanje sedišta',
    ],
  },
  {
    id: 'audi',
    name: 'Audi A5 Sportback',
    category: 'Limuzina',
    transmission: 'Automatik',
    fuel: 'Dizel',
    seats: 5,
    pricePerDay: 60,
    year: 2022,
    doors: 5,
    luggage: '3 velika kofera',
    mileage: 'Neograničena kilometraža',
    minAge: 18,
    deposit: 300,
    cancellation: 'Besplatno otkazivanje do 48h pre preuzimanja',
    description:
      'Premium sportski liftback, godište 2022, potpuno opremljen. Snažan motor i automatski menjač za maksimalnu udobnost na svakom putu.',
    en: {
      description:
        'A premium sporty liftback from 2022, fully equipped. A powerful engine and an automatic gearbox for maximum comfort on every trip.',
    },
    features: [
      'Osiguranje uključeno',
      'Klima uređaj',
      'Kožna sedišta',
      'Navigacija',
      'Bluetooth',
      'Tempomat',
      'Senzori za parkiranje',
      'Android Auto / CarPlay',
      'Kamera za vožnju unazad',
      'Grejanje sedišta',
    ],
  },
  {
    id: 'bmw',
    name: 'BMW M5',
    category: 'Sportska limuzina',
    comingSoon: true,
  },
  {
    id: 'merc',
    name: 'Mercedes-Benz C 300',
    category: 'Limuzina',
    comingSoon: true,
  },
];
