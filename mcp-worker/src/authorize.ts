import {
  AuthorizationError,
  CimdFetchError,
  type AuthRequest,
  type OAuthHelpers,
} from '@cloudflare/workers-oauth-provider';
import * as api from './api';
import { ApiError, type Lang } from './api';
import { codePage, consentPage, emailPage, errorPage, linkPage, texts } from './pages';
import {
  endFlow,
  forgetDevice,
  loadFlow,
  randomId,
  rememberDevice,
  rememberedDevice,
  saveFlow,
  startFlow,
  userIdFor,
  type Flow,
} from './state';
import type { Env } from './index';

// /authorize: sign in with an email code (or the link in the same email),
// then consent, then completeAuthorization(). The library validates the
// request and owns the consent handle; this file owns the sign-in, and the
// account calls go to public-api (api.ts).

export const SCOPES = ['mcp', 'offline_access'];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, business: 3, enterprise: 4 };

const langOf = (req: Request): Lang =>
  (req.headers.get('accept-language') ?? '').trim().toLowerCase().startsWith('it') ? 'it' : 'en';

/** What the client asked for, among what this server grants, and always `mcp`. */
export function grantedScopes(request: AuthRequest): string[] {
  return [...new Set(['mcp', ...request.scope.filter((s) => SCOPES.includes(s))])];
}

function page(body: string, nonce: string, status = 200, base?: Headers, cookies: string[] = []): Response {
  const headers = new Headers(base);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('x-frame-options', 'DENY');
  // No form-action: Chrome applies it to the redirect after the consent POST
  // too, and that redirect goes to the client (claude.ai, a loopback app).
  headers.set('content-security-policy',
    `default-src 'none'; img-src 'self'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; ` +
    `frame-ancestors 'none'; base-uri 'none'`);
  for (const c of cookies) headers.append('set-cookie', c);
  return new Response(body, { status, headers });
}

function authError(err: unknown, lang: Lang, nonce: string): Response {
  if (err instanceof AuthorizationError && err.redirectTo) return Response.redirect(err.redirectTo, 302);
  if (err instanceof AuthorizationError) return page(errorPage(lang, nonce, texts(lang).expired), nonce, 400);
  if (err instanceof CimdFetchError) {
    const msg = lang === 'it' ? 'Questa app non può essere verificata.' : 'This app could not be verified.';
    return page(errorPage(lang, nonce, msg), nonce, 400);
  }
  throw err;
}

async function showConsent(oauth: OAuthHelpers, nonce: string, id: string, flow: Flow, cookies: string[] = [],
  error?: string): Promise<Response> {
  const tx = await oauth.beginConsent(flow.request);
  return page(consentPage(flow.lang, nonce, flow.details, id, tx.handle, flow.email ?? '', flow.plan ?? 'free',
    !flow.hasKey && !flow.connection, error), nonce, 200, tx.headers, cookies);
}

async function complete(oauth: OAuthHelpers, request: AuthRequest, email: string, connection: string,
  clientName: string): Promise<string> {
  const { redirectTo } = await oauth.completeAuthorization({
    request,
    userId: await userIdFor(email),
    metadata: { client: clientName },
    scope: grantedScopes(request),
    props: { connection, email },
  });
  return redirectTo;
}

// --- GET /authorize ------------------------------------------------------------

export async function startAuthorize(req: Request, env: Env, oauth: OAuthHelpers): Promise<Response> {
  const lang = langOf(req);
  const nonce = randomId(16);
  let request: AuthRequest;
  let details;
  try {
    request = await oauth.parseAuthRequest(req);
    details = await oauth.describeConsent(request);
  } catch (err) {
    return authError(err, lang, nonce);
  }

  // A remembered device skips the email and the code; a remembered consent
  // for the same client, redirect URI and user skips the page too.
  const device = await rememberedDevice(env.DEVICE_SECRET, req);
  const known = device ? await api.describeConnection(env.API_BASE, device.connection).catch(() => null) : null;
  if (device && known) {
    const remember = { secret: env.CONSENT_SECRET, subject: await userIdFor(known.email) };
    if (await oauth.isConsentRemembered(req, request, remember)) {
      return Response.redirect(await complete(oauth, request, known.email, device.connection, details.clientName), 302);
    }
    const { id, flow, setCookie } = await startFlow(env.OAUTH_KV, {
      request, details, lang, email: known.email, plan: known.plan, hasKey: true, connection: device.connection,
    });
    return showConsent(oauth, nonce, id, flow, [setCookie]);
  }

  const { id, setCookie } = await startFlow(env.OAUTH_KV, { request, details, lang });
  return page(emailPage(lang, nonce, details, id), nonce, 200, undefined,
    device ? [setCookie, forgetDevice()] : [setCookie]);
}

// --- GET /authorize/email --------------------------------------------------------

export function linkLanding(req: Request): Response {
  const lang = langOf(req);
  const nonce = randomId(16);
  return page(linkPage(lang, nonce), nonce);
}

// --- POST /authorize ---------------------------------------------------------------

async function afterSignIn(env: Env, oauth: OAuthHelpers, nonce: string, id: string, flow: Flow,
  session: string): Promise<Response> {
  const keys = await api.accountKeys(env.API_BASE, session);
  flow.session = session;
  flow.hasKey = keys.length > 0;
  flow.plan = keys.map((k) => k.plan).sort((a, b) => (PLAN_RANK[b] ?? 0) - (PLAN_RANK[a] ?? 0))[0] ?? 'free';
  await saveFlow(env.OAUTH_KV, id, flow);
  return showConsent(oauth, nonce, id, flow);
}

export async function continueAuthorize(req: Request, env: Env, oauth: OAuthHelpers): Promise<Response> {
  const form = await req.formData();
  const step = String(form.get('step') ?? '');
  const id = String(form.get('f') ?? '');
  const nonce = randomId(16);
  const flow = await loadFlow(env.OAUTH_KV, req, id);
  const lang = flow?.lang ?? langOf(req);
  const t = texts(lang);
  if (!flow) {
    // The link opened in another browser lands here too: the flow cookie is
    // not there, by design (see state.ts).
    return page(errorPage(lang, nonce, step === 'link' ? t.otherBrowser : t.expired), nonce, 400);
  }

  try {
    if (step === 'email' || step === 'resend') {
      const email = step === 'email' ? String(form.get('email') ?? '').trim().toLowerCase() : flow.email ?? '';
      if (!EMAIL_RE.test(email)) return page(emailPage(lang, nonce, flow.details, id, undefined, email), nonce, 400);
      try {
        await api.sendCode(env.API_BASE, email, lang, id);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'disposable-email') {
          return page(emailPage(lang, nonce, flow.details, id, t.disposable, email), nonce, 400);
        }
        throw err;
      }
      flow.email = email;
      await saveFlow(env.OAUTH_KV, id, flow);
      return page(codePage(lang, nonce, flow.details, id, email,
        step === 'resend' ? { kind: 'warn', message: t.resent } : undefined), nonce);
    }

    if (step === 'change') {
      delete flow.email;
      delete flow.session;
      delete flow.connection;
      flow.hasKey = undefined;
      await saveFlow(env.OAUTH_KV, id, flow);
      return page(emailPage(lang, nonce, flow.details, id), nonce, 200, undefined, [forgetDevice()]);
    }

    if (step === 'code') {
      const code = String(form.get('code') ?? '').replace(/\s+/g, '');
      if (!flow.email) return page(emailPage(lang, nonce, flow.details, id), nonce, 400);
      try {
        const { session } = await api.sessionFromCode(env.API_BASE, flow.email, code);
        return await afterSignIn(env, oauth, nonce, id, flow, session);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          return page(codePage(lang, nonce, flow.details, id, flow.email, { kind: 'error', message: t.wrongCode }),
            nonce, 401);
        }
        throw err;
      }
    }

    if (step === 'link') {
      try {
        const { session } = await api.sessionFromLink(env.API_BASE, String(form.get('t') ?? ''));
        return await afterSignIn(env, oauth, nonce, id, flow, session);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return page(errorPage(lang, nonce, t.expired), nonce, 401);
        throw err;
      }
    }

    if (step === 'consent') {
      const handle = String(form.get('handle') ?? '');
      if (form.get('decision') !== 'approve') {
        const denied = await oauth.denyConsent(req, handle);
        denied.headers.append('set-cookie', await endFlow(env.OAUTH_KV, id));
        return new Response(null, { status: 302, headers: denied.headers });
      }
      const acceptTerms = form.get('accept_terms') === '1';
      // Before approveConsent(), which consumes the handle: a missing tick is
      // shown again on a fresh page instead of making the user start over.
      if (!flow.connection && !flow.hasKey && !acceptTerms) return showConsent(oauth, nonce, id, flow, [], t.termsNeeded);
      if (!flow.email || (!flow.connection && !flow.session)) return page(errorPage(lang, nonce, t.expired), nonce, 400);
      const subject = await userIdFor(flow.email);
      const approved = await oauth.approveConsent(req, handle, {
        scope: grantedScopes(flow.request),
        remember: { secret: env.CONSENT_SECRET, subject },
      });
      let connection = flow.connection;
      if (!connection) {
        try {
          connection = (await api.connect(env.API_BASE, flow.session!, flow.details.clientName, acceptTerms)).connection;
        } catch (err) {
          if (err instanceof ApiError && err.code === 'no-free-key') {
            return page(errorPage(lang, nonce, t.noFreeKey), nonce, 403);
          }
          throw err;
        }
      }
      const redirectTo = await complete(oauth, approved.request, flow.email, connection, flow.details.clientName);
      const headers = approved.headers;
      headers.set('location', redirectTo);
      headers.append('set-cookie', await rememberDevice(env.DEVICE_SECRET, flow.email, connection));
      headers.append('set-cookie', await endFlow(env.OAUTH_KV, id));
      return new Response(null, { status: 302, headers });
    }
  } catch (err) {
    if (err instanceof AuthorizationError || err instanceof CimdFetchError) return authError(err, lang, nonce);
    if (err instanceof ApiError || err instanceof TypeError) {
      console.error(`authorize: ${step}: ${err instanceof ApiError ? err.status : ''} ${err.message}`);
      return page(errorPage(lang, nonce, t.unavailable), nonce, 503);
    }
    throw err;
  }

  return page(errorPage(lang, nonce, t.expired), nonce, 400);
}
