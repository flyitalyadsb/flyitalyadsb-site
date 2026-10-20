// API plans shown on /dati/api. The limits are enforced by public-api
// (nesso-infra k8s/flyitalyadsb/base/public-api/billing.py, PLANS) and the
// prices live on Stripe (nesso-infra terraform/stripe): keep the three in
// sync — this file is only what the page says.

export type PlanId = 'free' | 'starter' | 'pro' | 'business';

export interface Plan {
  id: PlanId;
  priceEur: number; // per month, before tax
  perMin: number;
  perMonth: number;
  maxRadiusKm: number | null; // null = worldwide
  commercial: boolean;
}

export const PLANS: Plan[] = [
  { id: 'free', priceEur: 0, perMin: 30, perMonth: 300_000, maxRadiusKm: 500, commercial: true },
  { id: 'starter', priceEur: 9, perMin: 60, perMonth: 1_000_000, maxRadiusKm: 1000, commercial: true },
  { id: 'pro', priceEur: 49, perMin: 300, perMonth: 10_000_000, maxRadiusKm: null, commercial: true },
  { id: 'business', priceEur: 249, perMin: 1000, perMonth: 50_000_000, maxRadiusKm: null, commercial: true },
];

// When the free-plan limits start (YYYY-MM-DD, Rome). null = not announced yet:
// a free key keeps today's limit (100 requests/minute per IP) and the Free card
// says so. 2026-10-27: owner, 2026-10-20 ("tutti in 7 giorni"), announced by
// email the same day; public-api switches on at the same date (FREE_TIER_FROM).
// The site is static: every text that uses it must read right before AND after.
export const FREE_LIMITS_FROM: string | null = '2026-10-27';

/** FREE_LIMITS_FROM as a date for the page: "27 ottobre 2026" / "27 October 2026". */
export function freeLimitsFrom(lang: 'it' | 'en'): string | null {
  if (!FREE_LIMITS_FROM) return null;
  const [y, m, d] = FREE_LIMITS_FROM.split('-').map(Number);
  return new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export const CHECKOUT_URL = 'https://api.flyitalyadsb.com/v2/billing/checkout';
