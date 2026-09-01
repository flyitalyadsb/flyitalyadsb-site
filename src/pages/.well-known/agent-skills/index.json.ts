import type { APIRoute } from 'astro';
import { SKILLS, skillDigest } from '../../../lib/mcp/skills';

const SITE = 'https://flyitalyadsb.com';

/**
 * Serves `/.well-known/agent-skills/index.json` — the Agent Readiness
 * scanner's `agentSkills` check. Shape mirrors nessodigitale.it's own
 * (`agentskills.io` discovery schema). Each entry's digest is computed from
 * the exact markdown its `SKILL.md` route serves, so it can't drift.
 */
export const GET: APIRoute = () => {
  return Response.json({
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: Object.values(SKILLS).map((skill) => ({
      name: skill.name,
      type: 'skill-md',
      description: skill.description,
      // Absolute, matching server-card.json's convention — a machine
      // consumer that cached this JSON out of its original fetch context
      // shouldn't have to guess the origin for a relative URL.
      url: `${SITE}/.well-known/agent-skills/${skill.name}/SKILL.md`,
      digest: skillDigest(skill.markdown),
    })),
  });
};
