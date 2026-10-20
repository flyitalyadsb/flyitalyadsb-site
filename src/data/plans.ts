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

// When the free-plan limits start. null = not announced yet: until then a free
// key keeps today's limit (100 requests/minute per IP, applied by public-api; the
// Free card says so). The note about the email notice was removed (owner, 2026-10-20).
export const FREE_LIMITS_FROM: string | null = null;

export const CHECKOUT_URL = 'https://api.flyitalyadsb.com/v2/billing/checkout';
