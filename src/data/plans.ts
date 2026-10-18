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
  enterpriseHost: boolean;
  commercial: boolean;
}

export const PLANS: Plan[] = [
  { id: 'free', priceEur: 0, perMin: 30, perMonth: 300_000, maxRadiusKm: 500, enterpriseHost: false, commercial: true },
  { id: 'starter', priceEur: 9, perMin: 60, perMonth: 1_000_000, maxRadiusKm: 1000, enterpriseHost: true, commercial: true },
  { id: 'pro', priceEur: 49, perMin: 300, perMonth: 10_000_000, maxRadiusKm: null, enterpriseHost: true, commercial: true },
  { id: 'business', priceEur: 249, perMin: 1000, perMonth: 50_000_000, maxRadiusKm: null, enterpriseHost: true, commercial: true },
];

// When the free-plan limits start. null = not announced yet: until then a free
// key keeps today's limit (100 requests/minute per IP at the edge) and the
// page says the date will be emailed with at least 30 days' notice.
export const FREE_LIMITS_FROM: string | null = null;

export const CHECKOUT_URL = 'https://api.flyitalyadsb.com/v2/billing/checkout';
