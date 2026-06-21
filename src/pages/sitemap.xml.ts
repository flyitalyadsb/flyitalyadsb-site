import type { APIRoute } from 'astro';
import { airports } from '../data/airports';
import { aircraftTypes } from '../data/aircraftTypes';

const SITE = 'https://flyitalyadsb.com';

// IT-relative paths; the EN variant of each is `/en` + path.
const staticPaths = [
  '/',
  '/aeroporti',
  '/aeromobili',
  '/dati',
  '/dati/archivio',
  '/rete',
  '/ricerca',
  '/ricerca/weather',
  '/chi-siamo',
  '/community/feeder',
  '/community/mlat',
];

// Directory build format serves every route with a trailing slash; emit the
// canonical (non-redirecting) URLs so crawlers index the 200 response directly.
const slash = (p: string) => (p === '/' ? '/' : `${p}/`);
const itUrl = (p: string) => `${SITE}${slash(p)}`;
const enUrl = (p: string) => `${SITE}/en${slash(p)}`;

export const GET: APIRoute = () => {
  const paths = [
    ...staticPaths,
    ...airports.map((a) => `/aeroporti/${a.slug}`),
    ...aircraftTypes.map((t) => `/aeromobili/${t.slug}`),
  ];

  const body = paths
    .map((p) => {
      const it = itUrl(p);
      const en = enUrl(p);
      const alternates = [
        `    <xhtml:link rel="alternate" hreflang="it" href="${it}"/>`,
        `    <xhtml:link rel="alternate" hreflang="en" href="${en}"/>`,
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${it}"/>`,
      ].join('\n');
      return [
        `  <url>\n    <loc>${it}</loc>\n${alternates}\n  </url>`,
        `  <url>\n    <loc>${en}</loc>\n${alternates}\n  </url>`,
      ].join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${body}
</urlset>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
