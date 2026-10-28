// Javna adresa sajta i podaci o firmi za Google i deljenje linka (Viber,
// WhatsApp, Instagram). Kad pređemo na pravi domen, promeni SAMO SITE_URL —
// mapa sajta, robots.txt i oznake za deljenje se prave iz ovoga pri build-u
// (scripts/vite-plugin-seo.js).
export const SITE_URL = 'https://rentacarluciano.vercel.app';

export const BUSINESS = {
  name: 'Luciano Rent a Car',
  email: 'luciano@gmail.com',
  streetAddress: 'Kralja Mihaila Zetskog 44',
  locality: 'Batajnica, Beograd',
  country: 'RS',
};

// Slika koja se prikazuje kad se link podeli (1200×630, public/og-image.jpg).
export const SHARE_IMAGE = '/og-image.jpg';
