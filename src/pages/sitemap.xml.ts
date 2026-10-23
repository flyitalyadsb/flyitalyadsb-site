import type { APIRoute } from 'astro';
import { airports } from '../data/airports';
import { aircraftTypes } from '../data/aircraftTypes';
import { localePath } from '../lib/routes';

const SITE = 'https://flyitalyadsb.com';

// IT-relative paths; the EN variant of each is localePath('en', path) —
// English slugs since 2026-10-18 (src/lib/routes.ts), not just `/en` + path.
const staticPaths = [
  '/',
  '/aeroporti',
  '/aeromobili',
  '/dati',
  '/dati/archivio',
  '/dati/api',
  '/dati/mcp',
  '/dati/api/docs',
  '/dati/api/docs/guida-rapida',
  '/dati/api/docs/autenticazione',
  '/dati/api/docs/endpoint',
  '/dati/api/docs/campi',
  '/dati/api/docs/limiti-ed-errori',
  '/dati/api/docs/storico',
  '/dati/api/docs/avvisi',
  '/dati/api/docs/mcp',
  '/dati/api/docs/uso-commerciale',
  '/dati/api/docs/changelog',
  '/faq',
  '/dati/confronto',
  '/rete',
  '/ricerca',
  '/ricerca/weather',
  '/chi-siamo',
  '/contatti',
  '/stato',
  '/termini',
  '/privacy',
  '/community/feeder',
  '/community/stato-feeder',
  '/community/mlat',
];

// Directory build format serves every route with a trailing slash; emit the
// canonical (non-redirecting) URLs so crawlers index the 200 response directly.
const slash = (p: string) => (p === '/' ? '/' : `${p}/`);
const itUrl = (p: string) => `${SITE}${slash(p)}`;
const enUrl = (p: string) => `${SITE}${localePath('en', slash(p))}`;

export const GET: APIRoute = () => {
  const paths = [
    ...staticPaths,
    ...airports.map((a) => `/aeroporti/${a.slug}`),
    ...aircraftTypes.map((t) => `/aeromobili/${t.slug}`),
  ];

  // No per-page content-change tracking exists (static data files, no CMS
  // timestamps) — build time is still an honest signal here, since the whole
  // site is regenerated and redeployed together on every change.
  const lastmod = new Date().toISOString();

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
        `  <url>\n    <loc>${it}</loc>\n    <lastmod>${lastmod}</lastmod>\n${alternates}\n  </url>`,
        `  <url>\n    <loc>${en}</loc>\n    <lastmod>${lastmod}</lastmod>\n${alternates}\n  </url>`,
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
