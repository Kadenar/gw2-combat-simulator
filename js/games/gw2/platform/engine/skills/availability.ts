/** Cast availability distinguishes permanent denials from commands that can retry at a known time. */
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export const CAST_READY: AvailabilityResult = Object.freeze({ ready: true });

/** Creates a command-scoped denial when time alone cannot make the attempted cast valid. */
export function denyCast(code: string, reason: string): AvailabilityResult {
  return { ready: false, retryAt: null, code, reason };
}

/** Creates a waitable denial with the exact simulation time at which every rule should be evaluated again. */
export function retryCast(retryAt: number, code: string, reason: string): AvailabilityResult {
  if (!Number.isFinite(retryAt)) {
    throw new TypeError('Cast availability retryAt must be finite.');
  }

  return { ready: false, retryAt, code, reason };
}

/**
 * Creates the common skill-scoped denial with a consistent warning. A null retry time rejects this rotation command;
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

/** Rejects unequipped slot skills before state gates; flips inherit their root's selection. */
export function selectedSlotSkillAvailability(
  context: { readonly config: Gw2Config; readonly catalog: CanonicalCatalog },
  skill: Skill
): AvailabilityResult | null {
  // An omitted loadout permits sandbox casts; an explicitly empty loadout equips nothing.
  if (context.config.selectedSkills == null || !['Heal', 'Utility', 'Elite'].includes(skill.type || '')) return null;
  let root = skill;
  while (root.flipParentId != null) {
    const parent = context.catalog.skillsById.get(root.flipParentId);
    if (!parent) break;
    root = parent;
  }

  return selectedSkillNameSet(context.config.selectedSkills).has(root.name)
    ? null
    : denySkillCast(skill, 'gw2.slot-not-equipped', 'the skill is not equipped.');
}
