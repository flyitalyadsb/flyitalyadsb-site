import { OAuthAuthorizationServer, OAuthResourceServer, insufficientScope } from '@cloudflare/workers-oauth-provider';
import { createMcpHandler } from 'mcp-handler';
import { initializeMcpServer } from '../../src/lib/mcp/server';
import { setV2Base } from '../../src/lib/mcp/v2-client';
import { continueAuthorize, linkLanding, SCOPES, startAuthorize } from './authorize';

/**
 * flyitalyadsb-mcp: flyitalyadsb.com/mcp with OAuth, in front of the Pages
 * site (Worker routes on the zone take precedence over the Pages custom
 * domain, for these paths only: terraform/cloudflare in nesso-infra).
 *
 *   /mcp + X-Api-Key        the MCP server as before, the caller's own key
 *   /mcp + Bearer           OAuth: the token's props carry a connection token
 *                           (public-api connect.py) used as the X-Api-Key
 *   /authorize[/email]      sign-in with an email code, then consent
 *   /oauth/token, /oauth/register, /.well-known/oauth-*   the library
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
}

export interface Props {
  connection: string;
  email: string;
}

const SERVER_INFO = { name: 'flyitalyadsb', version: '1.1.0' };
// Tokens: an hour each; the grant lives while it is used (90 days idle).
const ACCESS_TOKEN_TTL_S = 3600;
const REFRESH_TOKEN_IDLE_TTL_S = 90 * 24 * 3600;

function mcp(request: Request, apiKey: string): Promise<Response> {
  const handler = createMcpHandler((server) => initializeMcpServer(server, apiKey), { serverInfo: SERVER_INFO });
  return handler(request);
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
      resourceMetadata: { resource: `${site}/mcp`, authorization_servers: [site] },
      requiredScopes: ['mcp'],
      validateToken: (e) => (res, token) => auth.validateToken(res, token, e),
      handler: {
        fetch(request, _env, ctx) {
          if (!ctx.auth.scope.includes('mcp')) return insufficientScope(ctx.auth, ['mcp']);
          return mcp(request, ctx.props.connection);
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
      if (apiKey) return mcp(request, apiKey);
      return resource.fetch(request, env, ctx);
    }
    if (pathname.startsWith('/.well-known/oauth-protected-resource')) return resource.fetch(request, env, ctx);

    if (pathname === '/authorize') {
      const oauth = auth.getOAuthApi(env);
      return request.method === 'POST' ? continueAuthorize(request, env, oauth) : startAuthorize(request, env, oauth);
    }
    if (pathname === '/authorize/email') return linkLanding(request);

    return auth.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
