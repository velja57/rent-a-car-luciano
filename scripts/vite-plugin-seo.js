// Vite plugin: oznake za deljenje linka (Open Graph), podaci o firmi za Google
// (JSON-LD) u index.html, i robots.txt + sitemap.xml u build-u. Sve se pravi iz
// src/data (adresa sajta, vozila, radno vreme), pa se ne održava ručno.
import { fleet } from '../src/data/fleet.js';
import { PHONE_HREF, WORKING_HOURS } from '../src/data/rental.js';
import { BUSINESS, SHARE_IMAGE, SITE_URL } from '../src/data/site.js';
import { PATHS } from '../src/i18n/routes.js';
import { lowestRate } from '../src/lib/pricing.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad = (n) => String(n).padStart(2, '0');

const minPrice = Math.min(...fleet.map(lowestRate));
const maxPrice = Math.max(...fleet.map((c) => c.pricePerDay));
const title = `${BUSINESS.name} — rent a car Beograd`;
const description = `Iznajmljivanje vozila u Beogradu: ${fleet.length} vozila od ${minPrice}€ po danu, dostava na aerodrom Nikola Tesla, besplatno otkazivanje. Rezerviši za nekoliko klikova.`;

function metaTags() {
  const og = {
    'og:type': 'website',
    'og:site_name': BUSINESS.name,
    'og:title': title,
    'og:description': description,
    'og:url': `${SITE_URL}/`,
    'og:image': `${SITE_URL}${SHARE_IMAGE}`,
    'og:image:width': '1200',
    'og:image:height': '630',
    'og:locale': 'sr_RS',
    'og:locale:alternate': 'en_GB',
  };
  const twitter = {
    'twitter:card': 'summary_large_image',
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': `${SITE_URL}${SHARE_IMAGE}`,
  };
  return [
    ...Object.entries(og).map(([property, content]) => ({ tag: 'meta', attrs: { property, content }, injectTo: 'head' })),
    ...Object.entries(twitter).map(([name, content]) => ({ tag: 'meta', attrs: { name, content }, injectTo: 'head' })),
  ];
}

function businessJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoRental',
    name: BUSINESS.name,
    url: `${SITE_URL}/`,
    image: `${SITE_URL}${SHARE_IMAGE}`,
    telephone: PHONE_HREF.replace('tel:', ''),
    email: BUSINESS.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS.streetAddress,
      addressLocality: BUSINESS.locality,
      addressCountry: BUSINESS.country,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: WORKING_HOURS.weekdays.map((d) => DAY_NAMES[d]),
        opens: `${pad(WORKING_HOURS.from)}:00`,
        closes: `${pad(WORKING_HOURS.to)}:00`,
      },
    ],
    priceRange: `€${minPrice}–€${maxPrice}`,
    areaServed: 'Beograd',
    availableLanguage: ['sr', 'en'],
  };
}

function sitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const pages = [
    (p) => p.home,
    (p) => p.fleet,
    ...fleet.map((car) => (p) => p.vehicle(car.id)),
  ];
  const urls = pages.flatMap((page) =>
    ['sr', 'en'].map((lang) => {
      const alternates = ['sr', 'en']
        .map((alt) => `    <xhtml:link rel="alternate" hreflang="${alt}" href="${SITE_URL}${page(PATHS[alt])}"/>`)
        .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${page(PATHS.sr)}"/>`)
        .join('\n');
      return `  <url>\n    <loc>${SITE_URL}${page(PATHS[lang])}</loc>\n    <lastmod>${today}</lastmod>\n${alternates}\n  </url>`;
    }),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

function robots() {
  return `User-agent: *
Allow: /
Disallow: /admin

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

export default function seoPlugin() {
  return {
    name: 'luciano-seo',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        // Samo javni sajt — admin panel ostaje bez ovih oznaka (i ima noindex).
        if (!ctx.filename.endsWith('index.html')) return html;
        return {
          html,
          tags: [
            ...metaTags(),
            {
              tag: 'script',
              attrs: { type: 'application/ld+json' },
              children: JSON.stringify(businessJsonLd()),
              injectTo: 'head',
            },
          ],
        };
      },
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots() });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap() });
    },
  };
}
