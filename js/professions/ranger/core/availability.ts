import { flattenProfessionState, professionCoreState } from '../../../platform/engine/profession.js';
import { RANGER_SKILL_IDS as ID } from '../data/ids.js';
import type { AvailabilityResult } from '../../../platform/engine/types.js';
import type { RangerPrecastContext, RangerSkill } from '../types.js';
import { isRangerHammerVariant, normalizeRangerHammerSkillIds } from './hammer.js';
import { rangerEnduranceReadyAt } from './resources.js';
import { rangerBalanceValue, RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

function deny(skill: RangerSkill, code: string, cause: string): AvailabilityResult {
  return {
    ready: false,
    code,
    reason: `${skill.name} is unavailable - ${cause}`
  };
}

export function rangerCoreCastAvailability(context: RangerPrecastContext, skill: RangerSkill): AvailabilityResult {
  if (skill.id === ID.DODGE) {
    const cost = rangerBalanceValue(context, PROFILE.resources, 'resourceCost', 50);
    return professionCoreState(context).endurance + context.epsilon >= cost
      ? { ready: true }
      : {
          ready: false,
          retryAt: rangerEnduranceReadyAt(context, cost),
          code: 'ranger.endurance',
          reason: `Dodge requires ${cost} endurance.`
        };
  }
  if (skill.id === ID.PET_SWAP && flattenProfessionState(context.state.profession).beastmodeActive) {
    return deny(skill, 'ranger.pet-merged', 'leave Beastmode first.');
  }
  if (
    isRangerHammerVariant(skill.id) &&
    !normalizeRangerHammerSkillIds(context.config.selectedHammerSkillIds).includes(Number(skill.id))
  ) {
    return deny(skill, 'ranger.hammer-variant-not-selected', 'select this Hammer variant first.');
  }
  if (!skill.petSkill) return { ready: true };
  if (skill.petAutonomousSkill) {
    return deny(skill, 'ranger.pet-autonomous', 'the active pet uses this skill automatically.');
  }
  const state = flattenProfessionState(context.state.profession);
  if (state.beastmodeActive) {
    return deny(skill, 'ranger.pet-merged', 'leave Beastmode first.');
  }
  if (!((state.activePetSkillIds as unknown[]) || []).includes(skill.id)) {
    return deny(skill, 'ranger.inactive-pet', 'select the pet that owns this Beast skill.');
  }
  return { ready: true };
}
