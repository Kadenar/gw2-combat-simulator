import {
  applyClarionBond,
  applyPoisonMasterBeastSkill,
  applyRejuvenation,
  applySpiritedArrival,
  applyWolfsong,
  emitChildOfEarth
} from '#gw2/professions/ranger/core/traits/behavior.js';
import { applyRangerCommandTraits } from '#gw2/professions/ranger/core/traits/pet-behavior.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Shared trait dispatch recognizes commandable pet Beast skills and excludes family skills. */
export function isBeastSkill(skill: RangerSkill): boolean {
  return Boolean(skill.petSkill && !skill.petFamilySkill);
}

// Route successful completions to their trait rewards; recharge reservations happen at acceptance.
export function completeRangerTraits(context: RangerRuntime, skill: RangerSkill): void {
  if (skill.type === 'Heal') emitChildOfEarth(context, skill);

  // Trait consumers share the authored category, independent of tooltip wording.
  if (skill.categories?.includes('Command')) {
    applyRangerCommandTraits(context, skill, context.time);
  }

  if (!isBeastSkill(skill)) return;
  applyRangerBeastSkillTraits(context, skill, true);
}

export function applyRangerBeastSkillTraits(
  context: RangerRuntime,
  skill: RangerSkill,
  triggerPoisonMaster: boolean
): void {
  applyRejuvenation(context, skill);
  if (triggerPoisonMaster) applyPoisonMasterBeastSkill(context, skill);
  applyWolfsong(context, skill);
}

export function applyRangerPetSwapTraits(context: RangerRuntime, skill: RangerSkill): void {
  applySpiritedArrival(context, skill);
  applyClarionBond(context, skill);
}
