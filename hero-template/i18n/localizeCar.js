import { dictionaries } from './index';

// Podaci o vozilima (src/data) su na srpskom. Za engleski se vrednosti prevode
// preko en.carValues, a opis dolazi iz car.en. Filtriranje i logika uvek rade
// nad originalnim (srpskim) objektom — ovo je samo za prikaz.
export function localizeCar(car, lang) {
  if (lang === 'sr') return car;
  const t = dictionaries[lang];
  const values = t.carValues;
  const map = (group, value) => values[group][value] ?? value;
  return {
    ...car,
    category: map('category', car.category),
    transmission: car.transmission && map('transmission', car.transmission),
    fuel: car.fuel && map('fuel', car.fuel),
    drive: car.drive && map('drive', car.drive),
    luggage: car.luggage && map('luggage', car.luggage),
    consumption: car.consumption?.replace(',', '.'),
    features: car.features?.map((f) => map('features', f)),
    mileage: car.mileage && t.common.unlimitedMileage,
    cancellation: car.cancellation && t.common.freeCancellation,
    description: car.en?.description ?? car.description,
  };
}
