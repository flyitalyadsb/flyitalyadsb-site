// PostHog (EU Cloud, Nesso Labs organization, project "flyitalyadsb"; the
// project and its settings are Terraform in nesso-infra `terraform/posthog`).
//
// Since 2026-10-23 (owner's decision, legal advice taken): statistics cookies
// and session replay for every visitor, no consent banner.
//  - Every visitor: PostHog cookies (identity and PostHog's own opt-in flag)
//    on .flyitalyadsb.com, shared with the map (mappa.flyitalyadsb.com,
//    nesso-infra k8s/flyitalyadsb/base/mappa-analytics), so one visitor across
//    site and map; session replay (inputs always masked, never on the pages
//    that show a key or carry a sign-in token: NO_REPLAY); identify by the
//    email typed into the API forms.
//  - Who objects (the privacy page's button, or "Rifiuto" on the old banner,
//    honoured until it expires): cookieless. Nothing written to cookies or
//    storage, visitors counted by a hash PostHog computes server-side with a
//    daily salt; no replay, no identify (cookieless_mode 'on_reject').
// The objection is ours: the `fia_consent` cookie on .flyitalyadsb.com,
// shared with the map. PostHog's flag follows it at every load. 'on_reject'
// treats a visitor who never chose as rejected, so everyone else is opted in
// at load, silently.
//
// Events go through our own path, flyitalyadsb.com/fia (functions/fia/), not
// PostHog's hosts: blocklists of analytics domains don't drop them.
//
// Privacy notice (/privacy, /en/privacy) describes exactly this: change one,
// change the other.

import type { PostHog, CaptureResult } from 'posthog-js';
import { italianPath, localePath } from './routes';

// Public project key (phc_…): it ships in every page by design, like the
// Cloudflare Web Analytics token. Empty = analytics off.
const KEY = 'phc_nDwGB2j2ncFVsWoiM3kgWrqFkjmdWLvaCvMKW93fpCjm'; // project 313723
// Absolute, as the map uses the same proxy from its own host.
const API_HOST = 'https://flyitalyadsb.com/fia';
const UI_HOST = 'https://eu.posthog.com';
// Only the production site reports: Pages previews and localhost never do.
const PRODUCTION_HOST = 'flyitalyadsb.com';

// Pages that show an API key or carry a single-use token (#t= on the claim
// page, ?t= on the My API sign-in link): never recorded by session replay.
const NO_REPLAY = ['/dati/api/chiave', '/dati/api/account'].flatMap((p) => [p, localePath('en', p)]);

const CONSENT_COOKIE = 'fia_consent';
// 13 months: an objection should outlast the cookies it objects to (PostHog's
// is a year). The old banner's choices keep their own six-month Max-Age.
const CONSENT_MAX_AGE_S = 395 * 24 * 3600;
// Value "<choice>:<ms since epoch>": the cookie's own expiry is not readable
// from JS, the timestamp is. Keep the format in sync with mappa-analytics.
export const CONSENT_EVENT = 'fia:consent';

export type Choice = 'granted' | 'denied';

export function consent(): Choice | null {
  const m = document.cookie.match(/(?:^|;\s*)fia_consent=(granted|denied):(\d+)/);
  if (!m) return null;
  return Date.now() - Number(m[2]) < CONSENT_MAX_AGE_S * 1000 ? (m[1] as Choice) : null;
}

/** The visitor objected to statistics: cookieless from then on. */
export const objected = () => consent() === 'denied';

function storeConsent(choice: Choice) {
  // Domain only on the real site: a Domain attribute that does not match the
  // host (localhost, *.pages.dev previews) makes the browser drop the cookie.
  const h = location.hostname;
  const domain = h === PRODUCTION_HOST || h.endsWith('.' + PRODUCTION_HOST) ? `; Domain=${PRODUCTION_HOST}` : '';
  document.cookie = `${CONSENT_COOKIE}=${choice}:${Date.now()}; Max-Age=${CONSENT_MAX_AGE_S}; Path=/${domain}; SameSite=Lax; Secure`;
}

const ON = !!KEY && location.hostname === PRODUCTION_HOST;
let ph: PostHog | null = null;
let started = false;
// Calls made before PostHog has loaded wait here, including those made before
// startAnalytics() runs (a page's own script can come first: the FAQ's ?q=
// search, the thank-you page's checkout_completed). null = analytics off.
let queue: ((p: PostHog) => void)[] | null = ON ? [] : null;

function withPostHog(fn: (p: PostHog) => void) {
  if (ph) fn(ph);
  else queue?.push(fn);
}

// `sync`: aligning PostHog with a choice made earlier (or on the map), or
// opting in a visitor who never objected — not a click, so no $opt_in event.
function applyConsent(p: PostHog, choice: Choice | null, sync = false) {
  const current = p.get_explicit_consent_status();
  if (choice === 'denied') {
    if (current !== 'denied') p.opt_out_capturing();
  } else if (current !== 'granted') {
    p.opt_in_capturing(sync ? { captureEventName: false } : undefined);
  }
}

/** The privacy page's button: object to statistics, or withdraw the objection. */
export function setConsent(choice: Choice) {
  storeConsent(choice);
  withPostHog((p) => applyConsent(p, choice));
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }));
}

/** A product event. `leaving`: the page is about to navigate away (beacon). */
export function track(event: string, props?: Record<string, unknown>, leaving = false) {
  withPostHog((p) => p.capture(event, props, leaving ? { transport: 'sendBeacon', send_instantly: true } : undefined));
}

/** Ties this browser's events to an email, unless the visitor objected. */
export function identify(email: string) {
  const id = email.trim().toLowerCase();
  if (!id) return;
  withPostHog((p) => {
    if (!objected()) p.identify(id, { email: id });
  });
}

/** My API sign-out: the next events no longer belong to that email. */
export function forget() {
  withPostHog((p) => { if (!objected()) p.reset(); });
}

// The kind of page, for breakdowns that hold across languages and slugs
// (every airport page is "airport"). Matched on the Italian path; the 404
// page says so itself (Layout.astro, data-page-type).
const PAGE_TYPES: [RegExp, string][] = [
  [/^\/$/, 'home'],
  [/^\/aeroporti\/$/, 'airports'],
  [/^\/aeroporti\//, 'airport'],
  [/^\/aeromobili\/$/, 'aircraft_types'],
  [/^\/aeromobili\//, 'aircraft'],
  [/^\/dati\/api\/docs\//, 'api_docs'],
  [/^\/dati\/api\/chiave\//, 'api_key'],
  [/^\/dati\/api\/account\//, 'api_account'],
  [/^\/dati\/api\/grazie\//, 'api_thanks'],
  [/^\/dati\/api\/$/, 'api'],
  [/^\/dati\/mcp\//, 'mcp'],
  [/^\/dati\/archivio\//, 'archive'],
  [/^\/dati\/confronto\//, 'comparison'],
  [/^\/dati\/$/, 'data'],
  [/^\/community\/stato-feeder\//, 'feeder_status'],
  [/^\/community\/feeder\//, 'feeder'],
  [/^\/community\/mlat\//, 'mlat'],
  [/^\/rete\//, 'network'],
  [/^\/ricerca\//, 'research'],
  [/^\/faq\//, 'faq'],
  [/^\/chi-siamo\//, 'about'],
  [/^\/contatti\//, 'contact'],
  [/^\/termini\//, 'terms'],
  [/^\/privacy\//, 'privacy'],
];

function pageType(): string {
  const own = document.documentElement.dataset.pageType;
  if (own) return own;
  const p = location.pathname;
  const it = p === '/en' || p.startsWith('/en/') ? italianPath(p) : p;
  return PAGE_TYPES.find(([re]) => re.test(it))?.[1] ?? 'other';
}

// Single-use tokens travel as `t=` in the claim (#t=) and sign-in (?t=) links,
// and the claim page copies #t= into the language-switch hrefs. PostHog
// records URLs whole (current URL, referrer, initial URL, autocaptured hrefs),
// so `t=` is blanked everywhere before an event leaves the browser.
const TOKEN = /([?#&])t=[^&#"'\s;]*/g;
function scrub<T>(v: T): T {
  if (typeof v === 'string') return v.replace(TOKEN, '$1t=redacted') as T;
  if (Array.isArray(v)) return v.map(scrub) as T;
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = scrub(x);
    return out as T;
  }
  return v;
}

// page_type and lang go on each event here rather than as super properties:
// PostHog persists those in its cookie, which the map shares, so the map's
// events would carry the last site page's type.
let pageProps: Record<string, string> = {};
function beforeSend(e: CaptureResult | null): CaptureResult | null {
  // Replay snapshots are big and never run on the token pages (NO_REPLAY).
  if (!e || e.event === '$snapshot') return e;
  return {
    ...e,
    properties: { ...scrub(e.properties), ...pageProps },
    $set: scrub(e.$set),
    $set_once: scrub(e.$set_once),
  };
}

export function startAnalytics() {
  if (!ON || started) return;
  started = true;
  pageProps = { page_type: pageType(), lang: document.documentElement.lang || 'it' };
  const path = location.pathname.replace(/\/+$/, '');
  const noReplay = NO_REPLAY.some((p) => path === p || path.startsWith(p + '/'));
  import('posthog-js').then(({ default: posthog }) => {
    posthog.init(KEY, {
      api_host: API_HOST,
      ui_host: UI_HOST,
      defaults: '2026-08-30',
      cookieless_mode: 'on_reject',
      person_profiles: 'identified_only',
      cross_subdomain_cookie: true,
      // PostHog's own opt-in flag in a cookie too (default: per-origin
      // localStorage), so site and map start from the same state and the map
      // does not mint a second distinct_id when it syncs.
      opt_out_capturing_persistence_type: 'cookie',
      disable_session_recording: noReplay,
      session_recording: { maskAllInputs: true },
      before_send: beforeSend,
      loaded: (p) => {
        applyConsent(p, consent(), true);
        ph = p;
        const pending = queue ?? [];
        queue = [];
        pending.forEach((fn) => fn(p));
      },
    });
  }).catch(() => { queue = null; });
}
