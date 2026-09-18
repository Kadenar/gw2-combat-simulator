import { defaultWeaponSkillMatchesSet } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2WeaponMatcherContext } from '#gw2/platform/equipment/weapons/types.js';

/** Selects specialization-specific weapon identities at the Elementalist family boundary. */
export function elementalistWeaponSkillMatchesSet(
  skill: Skill,
  weapons: readonly (string | undefined)[] = [],
  context: Gw2WeaponMatcherContext = {}
): boolean {
  // Keep normal attunement rows visible while wielding a conjure; cast availability still enforces dropping it first.
  // Dual-attunement ("Fire+Air") skills exist in the shared catalog but only Weaver has them.
  if (
    String(skill.attunement || '').includes('+') &&
    (context.specialization || context.config?.specialization || 'Core') !== 'Weaver'
  )
    return false;
  return defaultWeaponSkillMatchesSet(skill, weapons, context);
}
