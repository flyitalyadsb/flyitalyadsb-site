// Italian ↔ English paths (2026-10-18: English slugs for English SEO).
// The Italian site keeps its paths; every /en/ page has an English path, and
// the old /en/<italian-slug> URLs 301 to the new ones (public/_redirects —
// keep the two lists in sync). Slugs of individual airports and aircraft
// types (milano-malpensa, boeing-787-9) are names, not words: unchanged.

export type Lang = 'it' | 'en';

// Italian prefix → English prefix, without the /en part. Matched on whole
// path segments, longest first.
const PREFIXES: [string, string][] = [
  ['/dati/api/account', '/data/api/account'],
  ['/dati/api/chiave', '/data/api/key'],
  ['/dati/api/grazie', '/data/api/thanks'],
  ['/dati/api', '/data/api'],
  ['/dati/archivio', '/data/archive'],
  ['/dati/confronto', '/data/comparison'],
  ['/dati', '/data'],
  ['/aeroporti', '/airports'],
  ['/aeromobili', '/aircraft'],
  ['/rete', '/network'],
  ['/ricerca', '/research'],
  ['/chi-siamo', '/about'],
  ['/contatti', '/contact'],
  ['/community/stato-feeder', '/community/feeder-status'],
  ['/termini', '/terms'],
];

const byLength = (i: 0 | 1) => [...PREFIXES].sort((a, b) => b[i].length - a[i].length);
const IT_FIRST = byLength(0);
const EN_FIRST = byLength(1);

function swap(path: string, table: [string, string][], from: 0 | 1): string {
  for (const pair of table) {
    const src = pair[from];
    const dst = pair[from === 0 ? 1 : 0];
    if (path === src || path.startsWith(src + '/') || path.startsWith(src + '#') || path.startsWith(src + '?')) {
      return dst + path.slice(src.length);
    }
  }
  return path;
}

/** '/aeroporti/pisa/' → '/en/airports/pisa/' (en), unchanged (it). */
export function localePath(lang: Lang, itPath: string): string {
  if (lang === 'it') return itPath;
  if (itPath === '/' || itPath === '') return '/en/';
  return '/en' + swap(itPath, IT_FIRST, 0);
}

/** '/en/airports/pisa/' → '/aeroporti/pisa/'. */
export function italianPath(enPath: string): string {
  if (enPath === '/en' || enPath === '/en/') return '/';
  return swap(enPath.replace(/^\/en(?=\/)/, ''), EN_FIRST, 1);
}

/** The same page in the other language (language switch, hreflang). */
export function otherLanguagePath(path: string): string {
  const isEn = path === '/en' || path.startsWith('/en/');
  return isEn ? italianPath(path) : localePath('en', path);
}
