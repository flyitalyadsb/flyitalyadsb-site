// The account side of a connection lives in public-api (nesso-infra
// k8s/flyitalyadsb/base/public-api/connect.py): the email code, the session,
// the free key and the connection token. This Worker only calls it, server
// side; nothing here is reachable from the browser directly.
//
// Header names are lowercase on purpose: a fetch() from a Worker can reach
// Cloudflare with the casing the code used, and exact-match WAF rules on
// header names would miss a mixed-case one (see v2-client.ts).

export type Lang = 'it' | 'en';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function call<T>(base: string, path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${base.replace(/\/+$/, '')}${path}`, init);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(res.status, typeof body.code === 'string' ? body.code : undefined,
      typeof body.error === 'string' ? body.error : `HTTP ${res.status}`);
  }
  return body as T;
}

const json = (payload: unknown, session?: string): RequestInit => ({
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(session ? { authorization: `Bearer ${session}` } : {}),
  },
  body: JSON.stringify(payload),
});

/** Sends the email with the 6-digit code and the link back to `flow`. Always
 * 202 for a well-formed address, so the answer never says whether it has a key. */
export function sendCode(base: string, email: string, lang: Lang, flow: string): Promise<unknown> {
  return call(base, '/v2/account/login', json({ email, lang, purpose: 'connect', flow }));
}

export function sessionFromCode(base: string, email: string, code: string): Promise<{ session: string }> {
  return call(base, '/v2/account/session', json({ email, code }));
}

export function sessionFromLink(base: string, token: string): Promise<{ session: string }> {
  return call(base, '/v2/account/session', json({ token }));
}

export interface AccountKey {
  plan: string;
}

/** Who a session belongs to, and its keys: the auth.md claim page checks that
 * the person who signed in is the one the agent named. */
export function accountMe(base: string, session: string): Promise<{ email: string; keys: AccountKey[] }> {
  return call(base, '/v2/account/me', { headers: { authorization: `Bearer ${session}` } });
}

/** Only what the consent page needs: whether the email has a key, and its plan. */
export async function accountKeys(base: string, session: string): Promise<AccountKey[]> {
  const me = await call<{ keys: AccountKey[] }>(base, '/v2/account/me', {
    headers: { authorization: `Bearer ${session}` },
  });
  return me.keys ?? [];
}

export function connect(
  base: string,
  session: string,
  clientName: string,
  acceptTerms: boolean,
): Promise<{ connection: string; plan: string; key_created: boolean }> {
  return call(base, '/v2/account/connect', json({ client_name: clientName, accept_terms: acceptTerms }, session));
}

/** A remembered connection, if it still works: revoked connections and
 * accounts without an active key answer 401, and then this is null. */
export async function describeConnection(
  base: string,
  connection: string,
): Promise<{ email: string; plan: string } | null> {
  try {
    return await call(base, '/v2/account/connection', { headers: { 'x-api-key': connection } });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}
