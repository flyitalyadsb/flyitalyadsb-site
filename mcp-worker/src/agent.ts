import * as api from './api';
import { ApiError, type Lang } from './api';
import { langOf, page } from './authorize';
import { agentCodePage, agentConfirmPage, agentStartPage, errorPage, texts } from './pages';
import { cookie, randomId, seal, setCookie, sha256hex, unseal } from './state';
import type { Env } from './index';

// auth.md (github.com/workos/auth.md, v0.6.0): agent registration without a
// browser redirect. An agent that only knows the user's email registers with
// `service_auth`; the user opens the link the agent gives them, signs in here
// with the usual email code and types the 6-digit code the agent shows them;
// the agent polls /oauth/token with the claim grant and receives a public-api
// connection token, the same kind /authorize stores in an OAuth grant. It works
// as Bearer on /mcp and as X-Api-Key on the REST API, until the user
// disconnects it from La mia API.
//
// Only service_auth. `anonymous` would hand out access without an email (the
// free key is one per mailbox), and ID-JAG needs a list of trusted identity
// providers. No email is sent at registration: the person asks for the code
// on the claim page, so an agent can't mail anyone by registering.

export const CLAIM_GRANT = 'urn:workos:agent-auth:grant-type:claim';
// Agent flow ids start with this, so the email link (which always posts to
// /authorize) can be told apart from an OAuth flow. public-api accepts flow
// ids of [A-Za-z0-9_-]{16,64}.
export const AGENT_FLOW_PREFIX = 'agent_';

const REG_TTL_S = 3600; // the outer claim window
const CODE_TTL_S = 600; // one user_code, RFC 8628 expires_in
const POLL_INTERVAL_S = 5;
const CODE_ATTEMPTS = 5;
const REG_PER_IP_HOUR = 20;
const FLOW_TTL_S = 20 * 60;
const FLOW_COOKIE = '__Host-fia-aflow';
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CLIENT_NAME = 'AI agent (auth.md)';

// KV (OAUTH_KV), next to the library's keys and the /authorize flows:
//   fia-areg:<sha256(claim_token)>   the registration; kept an hour past its
//                                    window so late calls get expired_token
//   fia-aatt:<sha256(attempt token)> → the registration key, for one user_code
//   fia-apoll:<registration key>     last poll time, apart from the record so a
//                                    poll can never overwrite a claim
//   fia-aflow:<flow id>              the claim page, bound to its browser
//   fia-arl:<sha256(ip)>:<hour>      registrations per IP
interface Registration {
  id: string;
  email: string;
  lang: Lang;
  expires: number;
  status: 'pending' | 'claimed' | 'denied';
  attempt?: { hash: string; code: string; expires: number; tries: number };
  connection?: string; // sealed (state.ts)
}

interface AgentFlow {
  bind: string;
  reg: string;
  attempt: string;
  email: string;
  lang: Lang;
  session?: string;
  hasKey?: boolean;
}

const site = (env: Env) => env.SITE.replace(/\/+$/, '');
const endpoints = (env: Env) => ({
  identity: `${site(env)}/oauth/agent/identity`,
  claim: `${site(env)}/oauth/agent/identity/claim`,
});

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
  });
}

const fail = (status: number, error: string, description: string) =>
  json(status, { error, error_description: description });

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function sixDigits(): string {
  return (crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).toString().padStart(6, '0');
}

async function getReg(env: Env, key: string): Promise<Registration | null> {
  return (await env.OAUTH_KV.get(`fia-areg:${key}`, 'json')) as Registration | null;
}

async function putReg(env: Env, key: string, reg: Registration): Promise<void> {
  const ttl = Math.max(60, Math.ceil((reg.expires - Date.now()) / 1000) + 3600);
  await env.OAUTH_KV.put(`fia-areg:${key}`, JSON.stringify(reg), { expirationTtl: ttl });
}

/** A fresh user_code and the link that carries its attempt token. */
async function newAttempt(env: Env, regKey: string) {
  const token = randomId(32);
  const code = sixDigits();
  const attempt = { hash: await sha256hex(token), code: await sha256hex(code), expires: Date.now() + CODE_TTL_S * 1000, tries: 0 };
  await env.OAUTH_KV.put(`fia-aatt:${attempt.hash}`, regKey, { expirationTtl: CODE_TTL_S });
  const block = {
    user_code: code,
    expires_in: CODE_TTL_S,
    verification_uri: `${site(env)}/authorize/agent?t=${token}`,
    interval: POLL_INTERVAL_S,
  };
  return { attempt, block };
}

async function underRateLimit(env: Env, req: Request): Promise<boolean> {
  const ip = req.headers.get('cf-connecting-ip') ?? 'local';
  const key = `fia-arl:${(await sha256hex(`fia-ip:${ip}`)).slice(0, 32)}:${Math.floor(Date.now() / 3_600_000)}`;
  const n = Number((await env.OAUTH_KV.get(key)) ?? 0);
  if (n >= REG_PER_IP_HOUR) return false;
  await env.OAUTH_KV.put(key, String(n + 1), { expirationTtl: 3600 });
  return true;
}

// --- POST /oauth/agent/identity ------------------------------------------------

export async function registerAgent(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return fail(400, 'invalid_request', 'a JSON body is required');
  let email = '';
  if (body.type === 'service_auth') email = str(body.login_hint);
  // auth.md v0.1 shape of the same thing, for agents written against it.
  else if (body.type === 'identity_assertion' && body.assertion_type === 'verified_email') email = str(body.assertion);
  else if (body.type === 'anonymous') return fail(400, 'anonymous_not_enabled', 'register with service_auth and the user\'s email');
  else if (body.type === 'identity_assertion') return fail(400, 'issuer_not_enabled', 'no identity provider is trusted here: use service_auth');
  else return fail(400, 'invalid_request', 'type must be service_auth');
  email = email.toLowerCase();
  if (!EMAIL_RE.test(email)) return fail(400, 'invalid_login_hint', 'login_hint must be an email address');
  if (!(await underRateLimit(env, req))) return fail(429, 'rate_limited', 'too many registrations from this address, try again later');

  const claimToken = `clm_${randomId(32)}`;
  const regKey = await sha256hex(claimToken);
  const { attempt, block } = await newAttempt(env, regKey);
  const lang: Lang = body.lang === 'it' || body.lang === 'en' ? body.lang : langOf(req);
  const reg: Registration = { id: `reg_${randomId(12)}`, email, lang, expires: Date.now() + REG_TTL_S * 1000, status: 'pending', attempt };
  await putReg(env, regKey, reg);
  return json(200, {
    registration_id: reg.id,
    registration_type: 'service_auth',
    claim_url: endpoints(env).claim,
    claim_token: claimToken,
    claim_token_expires: new Date(reg.expires).toISOString(),
    post_claim_scopes: ['mcp'],
    claim: block,
  });
}

// --- POST /oauth/agent/identity/claim: a fresh user_code ---------------------------

export async function reinitiateClaim(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const claimToken = str(body?.claim_token);
  if (!claimToken) return fail(400, 'invalid_claim_token', 'claim_token is required');
  const regKey = await sha256hex(claimToken);
  const reg = await getReg(env, regKey);
  if (!reg) return fail(400, 'invalid_claim_token', 'unknown claim_token: register again');
  if (reg.status !== 'pending') return fail(400, 'claimed_or_in_flight', 'this registration is already claimed or declined');
  if (Date.now() > reg.expires) return fail(410, 'claim_expired', 'the registration expired: register again');
  if (str(body?.email).toLowerCase() !== reg.email) return fail(400, 'invalid_request', 'email must be the one the registration was made for');
  if (reg.attempt) await env.OAUTH_KV.delete(`fia-aatt:${reg.attempt.hash}`);
  const { attempt, block } = await newAttempt(env, regKey);
  reg.attempt = attempt;
  await putReg(env, regKey, reg);
  return json(200, {
    registration_id: reg.id,
    claim_attempt_id: `cla_${randomId(12)}`,
    status: 'initiated',
    expires_at: new Date(attempt.expires).toISOString(),
    claim_attempt: block,
  });
}

// --- POST /oauth/token, grant_type=urn:workos:agent-auth:grant-type:claim -------------

export async function claimGrant(form: URLSearchParams, env: Env): Promise<Response> {
  const claimToken = form.get('claim_token') ?? '';
  if (!claimToken) return fail(400, 'invalid_request', 'claim_token is required');
  const regKey = await sha256hex(claimToken);
  const reg = await getReg(env, regKey);
  if (!reg) return fail(400, 'invalid_grant', 'unknown or already used claim_token');
  if (reg.status === 'claimed' && reg.connection) {
    const connection = await unseal(env.CONSENT_SECRET, reg.connection);
    // One answer per registration: the token leaves KV with it.
    await env.OAUTH_KV.delete(`fia-areg:${regKey}`);
    return json(200, { access_token: connection, token_type: 'Bearer', scope: 'mcp' });
  }
  if (reg.status === 'denied') {
    await env.OAUTH_KV.delete(`fia-areg:${regKey}`);
    return fail(400, 'access_denied', 'the user declined');
  }
  const now = Date.now();
  if (now > reg.expires || !reg.attempt || now > reg.attempt.expires) {
    return fail(400, 'expired_token', 'the code window closed: ask the claim endpoint for a new code');
  }
  const pollKey = `fia-apoll:${regKey}`;
  const last = Number((await env.OAUTH_KV.get(pollKey)) ?? 0);
  await env.OAUTH_KV.put(pollKey, String(now), { expirationTtl: 120 });
  if (now - last < (POLL_INTERVAL_S - 1) * 1000) return fail(400, 'slow_down', `poll at most every ${POLL_INTERVAL_S} seconds`);
  return fail(400, 'authorization_pending', 'the user has not confirmed the code yet');
}

// --- /authorize/agent: the page the user opens ------------------------------------

async function startFlow(env: Env, flow: Omit<AgentFlow, 'bind'>): Promise<{ id: string; setCookie: string }> {
  const id = AGENT_FLOW_PREFIX + randomId(18);
  const secret = randomId(32);
  await env.OAUTH_KV.put(`fia-aflow:${id}`, JSON.stringify({ ...flow, bind: await sha256hex(secret) }), { expirationTtl: FLOW_TTL_S });
  return { id, setCookie: setCookie(FLOW_COOKIE, `${id}.${secret}`, FLOW_TTL_S) };
}

/** The flow `id`, only if this browser started it (same binding as state.ts). */
async function loadFlow(env: Env, req: Request, id: string): Promise<AgentFlow | null> {
  const [cookieId, secret] = (cookie(req, FLOW_COOKIE) ?? '').split('.');
  if (!id || cookieId !== id || !secret) return null;
  const flow = (await env.OAUTH_KV.get(`fia-aflow:${id}`, 'json')) as AgentFlow | null;
  return flow && flow.bind === (await sha256hex(secret)) ? flow : null;
}

const saveFlow = (env: Env, id: string, flow: AgentFlow) =>
  env.OAUTH_KV.put(`fia-aflow:${id}`, JSON.stringify(flow), { expirationTtl: FLOW_TTL_S });

async function endFlow(env: Env, id: string): Promise<string> {
  await env.OAUTH_KV.delete(`fia-aflow:${id}`);
  return setCookie(FLOW_COOKIE, '', 0);
}

/** The registration behind a flow, while its user_code is still the one the page was opened for. */
async function liveReg(env: Env, flow: AgentFlow): Promise<Registration | null> {
  const reg = await getReg(env, flow.reg);
  const now = Date.now();
  if (!reg || reg.status !== 'pending' || now > reg.expires) return null;
  if (!reg.attempt || reg.attempt.hash !== flow.attempt || now > reg.attempt.expires) return null;
  return reg;
}

export async function startAgentClaim(req: Request, env: Env): Promise<Response> {
  const nonce = randomId(16);
  const token = new URL(req.url).searchParams.get('t') ?? '';
  const attempt = token ? await sha256hex(token) : '';
  const regKey = attempt ? await env.OAUTH_KV.get(`fia-aatt:${attempt}`) : null;
  const reg = regKey ? await getReg(env, regKey) : null;
  // The browser's language; the one the agent registered with only if the
  // browser sends none.
  const lang = req.headers.get('accept-language') || !reg ? langOf(req) : reg.lang;
  const t = texts(lang);
  if (!regKey || !reg || reg.status !== 'pending' || Date.now() > reg.expires || reg.attempt?.hash !== attempt) {
    return page(errorPage(lang, nonce, t.agentExpired), nonce, 400);
  }
  const { id, setCookie: flowCookie } = await startFlow(env, { reg: regKey, attempt, email: reg.email, lang });
  return page(agentStartPage(lang, nonce, id, reg.email), nonce, 200, undefined, [flowCookie]);
}

async function afterSignIn(env: Env, nonce: string, id: string, flow: AgentFlow, session: string): Promise<Response> {
  const t = texts(flow.lang);
  const me = await api.accountMe(env.API_BASE, session);
  if (me.email.toLowerCase() !== flow.email) return page(errorPage(flow.lang, nonce, t.agentWrongAccount), nonce, 403);
  flow.session = session;
  flow.hasKey = (me.keys ?? []).length > 0;
  await saveFlow(env, id, flow);
  return page(agentConfirmPage(flow.lang, nonce, id, flow.email, !flow.hasKey), nonce);
}

export async function continueAgent(req: Request, env: Env, form?: FormData): Promise<Response> {
  form ??= await req.formData();
  const step = String(form.get('step') ?? '');
  const id = String(form.get('f') ?? '');
  const nonce = randomId(16);
  const flow = await loadFlow(env, req, id);
  const lang = flow?.lang ?? langOf(req);
  const t = texts(lang);
  if (!flow) return page(errorPage(lang, nonce, step === 'link' ? t.otherBrowser : t.agentExpired), nonce, 400);
  const reg = await liveReg(env, flow);
  if (!reg) return page(errorPage(lang, nonce, t.agentExpired), nonce, 400, undefined, [await endFlow(env, id)]);

  try {
    if (step === 'send' || step === 'resend') {
      try {
        await api.sendCode(env.API_BASE, flow.email, lang, id);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'disposable-email') return page(errorPage(lang, nonce, t.disposable), nonce, 400);
        throw err;
      }
      return page(agentCodePage(lang, nonce, id, flow.email,
        step === 'resend' ? { kind: 'warn', message: t.resent } : undefined), nonce);
    }

    if (step === 'code') {
      const code = String(form.get('code') ?? '').replace(/\s+/g, '');
      try {
        const { session } = await api.sessionFromCode(env.API_BASE, flow.email, code);
        return await afterSignIn(env, nonce, id, flow, session);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          return page(agentCodePage(lang, nonce, id, flow.email, { kind: 'error', message: t.wrongCode }), nonce, 401);
        }
        throw err;
      }
    }

    if (step === 'link') {
      try {
        const { session } = await api.sessionFromLink(env.API_BASE, String(form.get('t') ?? ''));
        return await afterSignIn(env, nonce, id, flow, session);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return page(errorPage(lang, nonce, t.agentExpired), nonce, 401);
        throw err;
      }
    }

    if (step === 'confirm') {
      if (!flow.session) return page(errorPage(lang, nonce, t.agentExpired), nonce, 400);
      if (form.get('decision') !== 'approve') {
        reg.status = 'denied';
        await putReg(env, flow.reg, reg);
        await env.OAUTH_KV.delete(`fia-aatt:${flow.attempt}`);
        return page(errorPage(lang, nonce, t.agentDenied), nonce, 200, undefined, [await endFlow(env, id)]);
      }
      const attempt = reg.attempt!;
      const typed = String(form.get('user_code') ?? '').replace(/\s+/g, '');
      if (!/^\d{6}$/.test(typed) || (await sha256hex(typed)) !== attempt.code) {
        attempt.tries += 1;
        if (attempt.tries >= CODE_ATTEMPTS) {
          attempt.expires = 0;
          await putReg(env, flow.reg, reg);
          await env.OAUTH_KV.delete(`fia-aatt:${flow.attempt}`);
          return page(errorPage(lang, nonce, t.agentTooMany), nonce, 403, undefined, [await endFlow(env, id)]);
        }
        await putReg(env, flow.reg, reg);
        return page(agentConfirmPage(lang, nonce, id, flow.email, !flow.hasKey, t.agentWrongCode(CODE_ATTEMPTS - attempt.tries)), nonce, 401);
      }
      const acceptTerms = form.get('accept_terms') === '1';
      if (!flow.hasKey && !acceptTerms) return page(agentConfirmPage(lang, nonce, id, flow.email, true, t.termsNeeded), nonce, 400);
      let connection: string;
      try {
        connection = (await api.connect(env.API_BASE, flow.session, CLIENT_NAME, acceptTerms)).connection;
      } catch (err) {
        if (err instanceof ApiError && err.code === 'no-free-key') return page(errorPage(lang, nonce, t.noFreeKey), nonce, 403);
        throw err;
      }
      reg.status = 'claimed';
      reg.connection = await seal(env.CONSENT_SECRET, connection);
      await putReg(env, flow.reg, reg);
      await env.OAUTH_KV.delete(`fia-aatt:${flow.attempt}`);
      return page(errorPage(lang, nonce, t.agentDone), nonce, 200, undefined, [await endFlow(env, id)]);
    }
  } catch (err) {
    if (err instanceof ApiError || err instanceof TypeError) {
      console.error(`agent claim: ${step}: ${err instanceof ApiError ? err.status : ''} ${err.message}`);
      return page(errorPage(lang, nonce, t.unavailable), nonce, 503);
    }
    throw err;
  }
  return page(errorPage(lang, nonce, t.agentExpired), nonce, 400);
}

// --- discovery -------------------------------------------------------------------------

/** The library's RFC 8414 document, plus the claim grant and the auth.md block. */
export async function withAgentAuth(res: Response, env: Env): Promise<Response> {
  if (!res.ok) return res;
  const meta = (await res.json()) as Record<string, unknown>;
  const grants = Array.isArray(meta.grant_types_supported) ? (meta.grant_types_supported as string[]) : [];
  meta.grant_types_supported = [...new Set([...grants, CLAIM_GRANT])];
  const { identity, claim } = endpoints(env);
  meta.agent_auth = {
    skill: `${site(env)}/auth.md`,
    identity_endpoint: identity,
    claim_endpoint: claim,
    identity_types_supported: ['service_auth'],
    // auth.md v0.1 names of the same endpoints and of the email method, for
    // readers that still look for them (agent-readiness scanners). The
    // ceremony is v0.6's either way: auth.md on the site says so.
    register_uri: identity,
    claim_uri: claim,
    identity_assertion: { assertion_types_supported: ['verified_email'], credential_types_supported: ['access_token'] },
  };
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  return new Response(JSON.stringify(meta), { status: res.status, headers });
}

/** /.well-known/oauth-protected-resource at the root, where auth.md agents
 * look first (RFC 9728 clients ask /mcp's own, which the library serves). */
export function rootResourceMetadata(env: Env): Response {
  const s = site(env);
  return json(200, {
    resource: `${s}/mcp`,
    resource_name: 'FlyItalyADSB',
    resource_logo_uri: `${s}/logo.png`,
    authorization_servers: [s],
    scopes_supported: ['mcp'],
    bearer_methods_supported: ['header'],
    resource_documentation: `${s}/auth.md`,
  }, { 'cache-control': 'public, max-age=3600', 'access-control-allow-origin': '*' });
}
