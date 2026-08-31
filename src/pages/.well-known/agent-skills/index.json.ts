import type { APIRoute } from 'astro';
import { SKILLS, skillDigest } from '../../../lib/mcp/skills';

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
      url: `/.well-known/agent-skills/${skill.name}/SKILL.md`,
      digest: skillDigest(skill.markdown),
    })),
  });
};
