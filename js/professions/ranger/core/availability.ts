import { flattenProfessionState, professionCoreState } from '../../../platform/engine/profession.js';
import { RANGER_SKILL_IDS as ID } from '../data/ids.js';
import type { AvailabilityResult } from '../../../platform/engine/types.js';
import type { RangerPrecastContext, RangerSkill } from '../types.js';
import { isRangerHammerVariant, normalizeRangerHammerSkillIds } from './hammer.js';
import { rangerEnduranceReadyAt } from './resources.js';
import { rangerBalanceValue, RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { RANGER_SPEAR_STEALTH_FLIP_BY_PARENT } from './weapon-state.js';

function deny(skill: RangerSkill, code: string, cause: string): AvailabilityResult {
  return {
    ready: false,
    code,
    reason: `${skill.name} is unavailable - ${cause}`
  };
}

export function rangerCoreCastAvailability(context: RangerPrecastContext, skill: RangerSkill): AvailabilityResult {
  const state = professionCoreState(context);
  if (skill.id === ID.DODGE) {
    const cost = rangerBalanceValue(context, PROFILE.resources, 'resourceCost', 50);
    return state.endurance + context.epsilon >= cost
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
  const flipParent = skill.flipParentId == null ? null : context.catalog.skillsById.get(Number(skill.flipParentId));
  const spearStealthFlipId = RANGER_SPEAR_STEALTH_FLIP_BY_PARENT[Number(skill.id)];
  const isSpearStealthAttack = Object.values(RANGER_SPEAR_STEALTH_FLIP_BY_PARENT).includes(Number(skill.id));
  if (
    skill.type === 'Weapon' &&
    !isRangerHammerVariant(skill.id) &&
    (flipParent?.flipSkillId === skill.id || isSpearStealthAttack) &&
    Number(state.availableFlips[Number(skill.id)] || 0) <= context.start
  ) {
    return deny(skill, 'ranger.flip-inactive', `use ${flipParent?.name || 'its opening weapon skill'} first.`);
  }
  if (
    skill.type === 'Weapon' &&
    !isRangerHammerVariant(skill.id) &&
    ((skill.flipSkillId != null &&
      skill.flipSkillId !== skill.nextChainId &&
      Number(state.availableFlips[Number(skill.flipSkillId)] || 0) > context.start) ||
      (spearStealthFlipId != null && Number(state.availableFlips[spearStealthFlipId] || 0) > context.start))
  ) {
    return deny(skill, 'ranger.flip-active', 'use or wait out the active follow-up skill.');
  }
  if (!skill.petSkill) return { ready: true };
  if (skill.petAutonomousSkill) {
    return deny(skill, 'ranger.pet-autonomous', 'the active pet uses this skill automatically.');
  }
  const flattenedState = flattenProfessionState(context.state.profession);
  if (flattenedState.beastmodeActive) {
    return deny(skill, 'ranger.pet-merged', 'leave Beastmode first.');
  }
  if (!((flattenedState.activePetSkillIds as unknown[]) || []).includes(skill.id)) {
    return deny(skill, 'ranger.inactive-pet', 'select the pet that owns this Beast skill.');
  }
  return { ready: true };
}
