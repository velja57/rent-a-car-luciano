// Adrese stranica po jeziku. Srpski je podrazumevan (bez prefiksa), engleski je pod /en.
export const PATHS = {
  sr: { home: '/', fleet: '/vozila', vehicle: (id) => `/vozila/${id}` },
  en: { home: '/en', fleet: '/en/vehicles', vehicle: (id) => `/en/vehicles/${id}` },
};

export function langFromPath(pathname) {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'sr';
}

// Ista stranica na drugom jeziku (početna, flota ili vozilo); sve ostalo -> početna.
export function translatePath(pathname, toLang) {
  const from = PATHS[langFromPath(pathname)];
  const to = PATHS[toLang];
  const vehiclePrefix = `${from.fleet}/`;
  if (pathname.startsWith(vehiclePrefix)) return to.vehicle(pathname.slice(vehiclePrefix.length));
  if (pathname === from.fleet) return to.fleet;
  return to.home;
}
