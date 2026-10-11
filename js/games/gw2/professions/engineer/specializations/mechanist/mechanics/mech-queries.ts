import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { EngineerConfig, EngineerSimulationEvent, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Read-only command selection and event ownership queries shared by mech consumers. */

/** Only F1-F3 are mech commands; the summon/recall slot is excluded. */
export function isEngineerMechCommand(skill: EngineerSkill | undefined): boolean {
  const slot = skill?.mechanicSlot || 0;
  return slot >= 1 && slot <= 3;
}

/** Consumers use prepared ownership, including the original application carried by condition ticks. */
export function isEngineerMechEvent(event: EngineerSimulationEvent | null | undefined): boolean {
  return event?.metadata?.engineerMech === true || event?.application?.metadata?.engineerMech === true;
}

/** Resolve an authored command row without depending on trait identities in the mechanics layer. */
export function selectedMechCommand(
  traits: EngineerConfig | ReadonlySet<SkillId>,
  groups: readonly (readonly [SkillId, SkillId])[]
): SkillId {
  for (const [trait, skill] of groups) if (hasTrait(traits, trait)) return skill;
  return groups[0][1];
}
