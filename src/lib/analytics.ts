// PostHog (EU Cloud, Nesso Labs organization, project "flyitalyadsb"; the
// project and its settings are Terraform in nesso-infra `terraform/posthog`).
//
// Two modes, decided by the cookie banner (CookieBanner.astro):
//  - no choice yet, or declined: cookieless. Nothing is written to cookies or
//    storage, visitors are counted by a hash PostHog computes server-side; no
//    session replay, no identify. (cookieless_mode 'on_reject' +
//    opt_out_capturing_by_default: PostHog treats "not opted in" as rejected.)
//  - accepted: PostHog cookies, session replay (inputs always masked) and
//    identify by the email typed into the API forms.
// The choice is ours: the `fia_consent` cookie on .flyitalyadsb.com, a
// technical cookie needed to remember it. It is shared with the map
// (mappa.flyitalyadsb.com, nesso-infra k8s/flyitalyadsb/base/mappa-analytics),
// so one choice covers both, and so are PostHog's cookies (identity and its
// own opt-in flag, cross_subdomain_cookie): one visitor across site and map.
// PostHog's flag follows our cookie at every load.
//
// Privacy notice (/privacy, /en/privacy) describes exactly this: change one,
// change the other.

import type { PostHog, CaptureResult } from 'posthog-js';
import { localePath } from './routes';

// Public project key (phc_…): it ships in every page by design, like the
// Cloudflare Web Analytics token. Empty = analytics off.
const KEY = 'phc_nDwGB2j2ncFVsWoiM3kgWrqFkjmdWLvaCvMKW93fpCjm'; // project 313723
const API_HOST = 'https://eu.i.posthog.com';
const UI_HOST = 'https://eu.posthog.com';
// Only the production site reports: Pages previews and localhost never do.
const PRODUCTION_HOST = 'flyitalyadsb.com';

// Pages that show an API key or carry a single-use token (#t= on the claim
// page, ?t= on the My API sign-in link): never recorded by session replay.
const NO_REPLAY = ['/dati/api/chiave', '/dati/api/account'].flatMap((p) => [p, localePath('en', p)]);

const CONSENT_COOKIE = 'fia_consent';
// Six months, then the banner asks again (Garante, linee guida cookie
// 10/06/2021: a refusal must not be asked again sooner).
const CONSENT_MAX_AGE_S = 180 * 24 * 3600;
// Value "<choice>:<ms since epoch>": the cookie's own expiry is not readable
// from JS, the timestamp is. Keep the format in sync with mappa-analytics.
export const CONSENT_EVENT = 'fia:consent';

export type Choice = 'granted' | 'denied';

export function consent(): Choice | null {
  const m = document.cookie.match(/(?:^|;\s*)fia_consent=(granted|denied):(\d+)/);
  if (!m) return null;
  return Date.now() - Number(m[2]) < CONSENT_MAX_AGE_S * 1000 ? (m[1] as Choice) : null;
}

function storeConsent(choice: Choice) {
  // Domain only on the real site: a Domain attribute that does not match the
  // host (localhost, *.pages.dev previews) makes the browser drop the cookie.
  const h = location.hostname;
  const domain = h === PRODUCTION_HOST || h.endsWith('.' + PRODUCTION_HOST) ? `; Domain=${PRODUCTION_HOST}` : '';
  document.cookie = `${CONSENT_COOKIE}=${choice}:${Date.now()}; Max-Age=${CONSENT_MAX_AGE_S}; Path=/${domain}; SameSite=Lax; Secure`;
}

let ph: PostHog | null = null;
let queue: ((p: PostHog) => void)[] | null = null; // null = analytics off on this host

function withPostHog(fn: (p: PostHog) => void) {
  if (ph) fn(ph);
  else queue?.push(fn);
}

// `sync`: aligning PostHog with a choice made earlier (or on the map), not a
// click — no $opt_in event for it.
function applyConsent(p: PostHog, choice: Choice | null, sync = false) {
  const current = p.get_explicit_consent_status();
  if (choice === 'granted' && current !== 'granted') p.opt_in_capturing(sync ? { captureEventName: false } : undefined);
  else if (choice === 'denied' && current !== 'denied') p.opt_out_capturing();
  else if (choice === null && current !== 'pending') p.clear_opt_in_out_capturing();
}

export function setConsent(choice: Choice) {
  storeConsent(choice);
  withPostHog((p) => applyConsent(p, choice));
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }));
}

/** A product event. `leaving`: the page is about to navigate away (beacon). */
export function track(event: string, props?: Record<string, unknown>, leaving = false) {
  withPostHog((p) => p.capture(event, props, leaving ? { transport: 'sendBeacon', send_instantly: true } : undefined));
}

/** Ties this browser's events to an email — only with consent. */
export function identify(email: string) {
  const id = email.trim().toLowerCase();
  if (!id) return;
  withPostHog((p) => {
    if (consent() === 'granted') p.identify(id, { email: id });
  });
}

/** My API sign-out: the next events no longer belong to that email. */
export function forget() {
  withPostHog((p) => { if (consent() === 'granted') p.reset(); });
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
function beforeSend(e: CaptureResult | null): CaptureResult | null {
  // Replay snapshots are big and never run on the token pages (NO_REPLAY).
  if (!e || e.event === '$snapshot') return e;
  return { ...e, properties: scrub(e.properties), $set: scrub(e.$set), $set_once: scrub(e.$set_once) };
}

export function startAnalytics() {
  if (!KEY || location.hostname !== PRODUCTION_HOST || queue) return;
  queue = [];
  const path = location.pathname.replace(/\/+$/, '');
  const noReplay = NO_REPLAY.some((p) => path === p || path.startsWith(p + '/'));
  import('posthog-js').then(({ default: posthog }) => {
    posthog.init(KEY, {
      api_host: API_HOST,
      ui_host: UI_HOST,
      defaults: '2026-08-30',
      cookieless_mode: 'on_reject',
      opt_out_capturing_by_default: true,
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
