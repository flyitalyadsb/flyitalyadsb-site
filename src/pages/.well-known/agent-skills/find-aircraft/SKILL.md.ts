import type { APIRoute } from 'astro';
import { SKILLS } from '../../../../lib/mcp/skills';

export const GET: APIRoute = () => {
  return new Response(SKILLS['find-aircraft'].markdown, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
