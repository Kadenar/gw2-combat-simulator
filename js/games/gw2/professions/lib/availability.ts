import { denyCast, retryCast } from '#gw2/platform/engine/skills/availability.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import type { AvailabilityResult } from '#gw2/platform/engine/execution/types.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

/** Shares build eligibility across selectors and runtime; Weaponmaster Training is always active. */
export function defaultIsSkillAvailable(
  skill: Skill,
  { specialization }: { readonly specialization?: string } = {}
): boolean {
  if (skill.simulatorExcluded) return false;
  if (skill.type === 'Weapon') return true;
  return !skill.specialization || skill.specialization === specialization;
}

/** Reject unequipped slot skills before state gates; flips inherit their root's selection. */
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
