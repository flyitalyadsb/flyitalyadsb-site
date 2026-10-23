import { OAuthAuthorizationServer, OAuthResourceServer, insufficientScope } from '@cloudflare/workers-oauth-provider';
import { instrument } from '@posthog/mcp';
import { createMcpHandler } from 'mcp-handler';
import { PostHog } from 'posthog-node';
import { initializeMcpServer } from '../../src/lib/mcp/server';
import { setV2Base } from '../../src/lib/mcp/v2-client';
import {
  CLAIM_GRANT,
  claimGrant,
  continueAgent,
  registerAgent,
  reinitiateClaim,
  rootResourceMetadata,
  startAgentClaim,
  withAgentAuth,
} from './agent';
import { continueAuthorize, linkLanding, SCOPES, startAuthorize } from './authorize';

/**
 * flyitalyadsb-mcp: flyitalyadsb.com/mcp with OAuth, in front of the Pages
 * site (Worker routes on the zone take precedence over the Pages custom
 * domain, for these paths only: terraform/cloudflare in nesso-infra).
 *
 *   /mcp + X-Api-Key        the MCP server as before, the caller's own key
 *   /mcp + Bearer           OAuth: the token's props carry a connection token
 *                           (public-api connect.py) used as the X-Api-Key
 *   /mcp + Bearer fiamcp_   an auth.md agent's connection token (agent.ts)
 *   /authorize[/email]      sign-in with an email code, then consent
 *   /oauth/agent/identity[/claim], /authorize/agent   auth.md registration
 *   /oauth/token, /oauth/register, /.well-known/oauth-*   the library, plus
 *                           the auth.md claim grant and metadata (agent.ts)
 *
 * Design: nesso-infra docs/FLYITALYADSB-MCP-OAUTH.md.
 */
export interface Env {
  OAUTH_KV: KVNamespace;
  /** https://flyitalyadsb.com; http://localhost:8787 under wrangler dev. */
  SITE: string;
  /** https://api.flyitalyadsb.com, or a local public-api. */
  API_BASE: string;
  /** Worker secrets, 32+ random characters each. */
  CONSENT_SECRET: string;
  DEVICE_SECRET: string;
  /** PostHog project flyitalyadsb's public phc_ token; empty = no analytics. */
  POSTHOG_PROJECT_TOKEN?: string;
  POSTHOG_HOST?: string;
  /** "on": tools get the `context` and `conversation_id` arguments (see mcp()). */
  MCP_INTENTS?: string;
}

export interface Props {
  connection: string;
  email: string;
}

// 1.2.0: the in-chat aircraft map (MCP Apps resource ui://flyitalyadsb/aircraft-map.html).
const SERVER_INFO = { name: 'flyitalyadsb', version: '1.2.0' };
// Tokens: an hour each; the grant lives while it is used (90 days idle).
const ACCESS_TOKEN_TTL_S = 3600;
const REFRESH_TOKEN_IDLE_TTL_S = 90 * 24 * 3600;

// The status Worker's user agent (status-worker/src/probes.ts UA), see mcp().
const STATUS_PROBE_UA = 'flyitalyadsb-status/';

// What the model is asked to write in `context` when MCP_INTENTS is on.
const INTENT_DESCRIPTION =
  'In a few words, what the user wants to find out with this call. No names, addresses or other personal details: it is kept for usage statistics only.';

/**
 * The MCP server for one request, with MCP Analytics (@posthog/mcp, PostHog
 * project flyitalyadsb in nesso-infra terraform/posthog): a $mcp_tool_call
 * per tool call with the client, the model, latency and errors, and, as the
 * SDK sends them, the arguments with their values ($mcp_parameters,
 * positions included) and the whole result ($mcp_response). The person is
 * the account's email on the OAuth path, the same distinct_id as the site
 * and public-api; X-Api-Key callers and auth.md agents stay anonymous (the
 * Worker doesn't know their email).
 *
 * MCP_INTENTS=on (owner, 2026-10-23, approved by the DPO) adds `context`
 * (what the user wants, in the model's words), `conversation_id` and
 * `llm_model` to every tool's arguments, at runtime: the schemas published in
 * .well-known (src/lib/mcp/server.ts TOOLS) don't list them, and a call
 * without them still works. The site's privacy notice (point 2) describes
 * all of this: change them together.
 *
 * The status page's probe (status-worker/src/probes.ts) runs an `initialize`
 * every minute and stops there: it gets no events, or it would be most of
 * the project's MCP traffic, one new anonymous person per probe.
 */
function mcp(request: Request, apiKey: string, env: Env, ctx: ExecutionContext, email?: string): Promise<Response> {
  const probe = request.headers.get('user-agent')?.startsWith(STATUS_PROBE_UA) ?? false;
  const posthog = env.POSTHOG_PROJECT_TOKEN && !probe
    ? new PostHog(env.POSTHOG_PROJECT_TOKEN, { host: env.POSTHOG_HOST ?? 'https://eu.i.posthog.com', flushAt: 1, flushInterval: 0 })
    : null;
  const intents = env.MCP_INTENTS === 'on';
  const handler = createMcpHandler((server) => {
    if (posthog) {
      instrument(server, posthog, {
        context: intents ? { description: INTENT_DESCRIPTION } : false,
        enableConversationId: intents,
        captureModel: intents,
        identify: email ? { distinctId: email.trim().toLowerCase() } : null,
      });
    }
    initializeMcpServer(server, apiKey);
  }, { serverInfo: SERVER_INFO });
  return handler(request).then((res) => (posthog ? flushAfter(res, posthog, ctx) : res));
}

/** A tool can still be running while its response streams: send the events
 * once the body is done, under waitUntil so the Worker isn't stopped first. */
function flushAfter(res: Response, posthog: PostHog, ctx: ExecutionContext): Response {
  if (!res.body) {
    ctx.waitUntil(posthog.shutdown());
    return res;
  }
  const { readable, writable } = new TransformStream();
  ctx.waitUntil(res.body.pipeTo(writable).catch(() => undefined).finally(() => posthog.shutdown()));
  return new Response(readable, res);
}

// One pair per site: the issuer and the resource are fixed at construction,
// and SITE only differs between production and wrangler dev.
const roles = new Map<string, { auth: OAuthAuthorizationServer<Env>; resource: OAuthResourceServer<Env, Props> }>();

function rolesFor(env: Env) {
  const site = env.SITE.replace(/\/+$/, '');
  let r = roles.get(site);
  if (!r) {
    const auth = new OAuthAuthorizationServer<Env>({
      issuer: site,
      resources: [`${site}/mcp`],
      scopesSupported: SCOPES,
      // Claude's published identity (CIMD) first; DCR for clients without it.
      clientIdMetadataDocumentEnabled: true,
      clientRegistrationEndpoint: '/oauth/register',
      accessTokenTTL: ACCESS_TOKEN_TTL_S,
      refreshTokenIdleTTL: REFRESH_TOKEN_IDLE_TTL_S,
    });
    const resource = new OAuthResourceServer<Env, Props>({
      resourceMetadata: { resource: `${site}/mcp`, authorization_servers: [site], resource_name: 'FlyItalyADSB' },
      requiredScopes: ['mcp'],
      validateToken: (e) => (res, token) => auth.validateToken(res, token, e),
      handler: {
        fetch(request, env, ctx) {
          if (!ctx.auth.scope.includes('mcp')) return insufficientScope(ctx.auth, ['mcp']);
          return mcp(request, ctx.props.connection, env, ctx, ctx.props.email);
        },
      },
    });
    r = { auth, resource };
    roles.set(site, r);
  }
  return r;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    setV2Base(env.API_BASE);
    const { auth, resource } = rolesFor(env);
    const { pathname } = new URL(request.url);

    if (pathname === '/mcp' || pathname.startsWith('/mcp/')) {
      const apiKey = request.headers.get('x-api-key');
      if (apiKey) return mcp(request, apiKey, env, ctx);
      // auth.md agents get a connection token, not a library token: it is
      // already the key the tools send to the API.
      const agent = /^Bearer\s+(fiamcp_[A-Za-z0-9_-]+)$/i.exec(request.headers.get('authorization') ?? '');
      if (agent) return mcp(request, agent[1], env, ctx);
      return resource.fetch(request, env, ctx);
    }
    if (pathname === '/.well-known/oauth-protected-resource') return rootResourceMetadata(env);
    if (pathname.startsWith('/.well-known/oauth-protected-resource')) return resource.fetch(request, env, ctx);
    if (pathname === '/.well-known/oauth-authorization-server') return withAgentAuth(await auth.fetch(request, env, ctx), env);

    if (request.method === 'POST' && pathname === '/oauth/agent/identity') return registerAgent(request, env);
    if (request.method === 'POST' && pathname === '/oauth/agent/identity/claim') return reinitiateClaim(request, env);
    if (request.method === 'POST' && pathname === '/oauth/token'
      && (request.headers.get('content-type') ?? '').includes('application/x-www-form-urlencoded')) {
      const form = new URLSearchParams(await request.clone().text());
      if (form.get('grant_type') === CLAIM_GRANT) return claimGrant(form, env);
    }
    if (pathname === '/authorize/agent') {
      return request.method === 'POST' ? continueAgent(request, env) : startAgentClaim(request, env);
    }

    if (pathname === '/authorize') {
      const oauth = auth.getOAuthApi(env);
      return request.method === 'POST' ? continueAuthorize(request, env, oauth) : startAuthorize(request, env, oauth);
    }
    if (pathname === '/authorize/email') return linkLanding(request);

    return auth.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
