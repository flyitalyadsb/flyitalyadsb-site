// Fails when a built page links to one of our pages without its trailing slash.
//
// The site is built in directory format, so every page lives at /path/ and
// Cloudflare Pages answers /path with a 308 to /path/. Search Console then
// lists each such link under "Page with redirect": on 2026-10-22 there were
// 9,975 of them, from the menu, the footer and the cards. Run after
// `npm run build`: node scripts/check-links.mjs [dist]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const dist = process.argv[2] ?? 'dist';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(dist);
const pages = new Set(
  files
    .filter((f) => f.endsWith(`${sep}index.html`))
    .map((f) => '/' + relative(dist, f).split(sep).slice(0, -1).join('/') + '/')
    .map((p) => p.replace(/^\/\/$/, '/')),
);

// href/content/action values and absolute URLs of our own origin.
const attr = /\b(?:href|content|action)\s*=\s*["'](\/[^"'#?]*)/g;
const absolute = /https:\/\/flyitalyadsb\.com(\/[a-z0-9][a-z0-9/_-]*)/g;

const problems = [];
for (const file of files.filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');
  for (const re of [attr, absolute]) {
    for (const [, path] of html.matchAll(re)) {
      if (!path.endsWith('/') && pages.has(path + '/')) {
        problems.push(`${'/' + relative(dist, file).split(sep).join('/')}: ${path}`);
      }
    }
  }
}

if (problems.length) {
  console.error(`${problems.length} links without the trailing slash (each one is a redirect):`);
  for (const p of [...new Set(problems)].slice(0, 40)) console.error('  ' + p);
  process.exit(1);
}
console.log(`ok: ${pages.size} pages, no internal link without its trailing slash`);
