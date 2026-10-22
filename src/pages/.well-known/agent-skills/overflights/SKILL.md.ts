import type { APIRoute } from 'astro';
import { SKILLS } from '../../../../lib/mcp/skills';

export const GET: APIRoute = () => {
  return new Response(SKILLS.overflights.markdown, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
