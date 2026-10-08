import { applyRangerCommandTraits } from '#gw2/professions/ranger/core/traits/beastmastery/pet-behavior.js';
import { applyClarionBond, applyWolfsong } from '#gw2/professions/ranger/core/traits/marksmanship/beast-skills.js';
import {
  applyRejuvenation,
  applySpiritedArrival
} from '#gw2/professions/ranger/core/traits/nature-magic/beast-skills.js';
import { emitChildOfEarth } from '#gw2/professions/ranger/core/traits/wilderness-survival/index.js';
import { applyPoisonMasterBeastSkill } from '#gw2/professions/ranger/core/traits/wilderness-survival/poison.js';
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
