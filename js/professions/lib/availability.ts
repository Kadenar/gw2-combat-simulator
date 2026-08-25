import { denyCast, retryCast } from '../../platform/engine/skills/availability.js';
import type { AvailabilityResult, Skill } from '../../platform/engine/types.js';

/**
 * Creates the common profession-level unavailable result with a consistent
 * skill-specific warning. A null retry time rejects this rotation command;
 * a finite retry time asks the scheduler to try the same command later.
 */
export function denySkillCast(
  skill: Pick<Skill, 'name'>,
  code: string,
  cause: string,
  retryAt: number | null = null
): AvailabilityResult {
  const reason = `${skill.name} is unavailable — ${cause}`;
  return retryAt === null ? denyCast(code, reason) : retryCast(retryAt, code, reason);
}
