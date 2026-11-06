// Adrese stranica po jeziku. Srpski je podrazumevan (bez prefiksa), engleski je pod /en.
export const PATHS = {
  sr: {
    home: '/',
    fleet: '/vozila',
    vehicle: (id) => `/vozila/${id}`,
    terms: '/uslovi-najma',
    privacy: '/politika-privatnosti',
  },
  en: {
    home: '/en',
    fleet: '/en/vehicles',
    vehicle: (id) => `/en/vehicles/${id}`,
    terms: '/en/rental-terms',
    privacy: '/en/privacy-policy',
  },
};

export function langFromPath(pathname) {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'sr';
}

// Ista stranica na drugom jeziku (početna, flota, vozilo, uslovi najma, privatnost); sve ostalo -> početna.
export function translatePath(pathname, toLang) {
  const from = PATHS[langFromPath(pathname)];
  const to = PATHS[toLang];
  const vehiclePrefix = `${from.fleet}/`;
  if (pathname.startsWith(vehiclePrefix)) return to.vehicle(pathname.slice(vehiclePrefix.length));
  if (pathname === from.fleet) return to.fleet;
  if (pathname === from.terms) return to.terms;
  if (pathname === from.privacy) return to.privacy;
  return to.home;
}
