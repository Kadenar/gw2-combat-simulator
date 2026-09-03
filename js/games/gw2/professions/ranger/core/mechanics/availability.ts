import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { denySkillCast } from '#gw2/professions/lib/availability.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { AvailabilityResult } from '#gw2/platform/engine/types.js';
import type { RangerPrecastContext, RangerSkill } from '#gw2/professions/ranger/types.js';
import {
  isRangerHammerVariant,
  normalizeRangerHammerSkillIds
} from '#gw2/professions/ranger/core/mechanics/hammer-variants.js';
import { rangerEnduranceReadyAt } from '#gw2/professions/ranger/core/mechanics/resources.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { RANGER_SPEAR_STEALTH_FLIP_BY_PARENT } from '#gw2/professions/ranger/core/mechanics/weapon-state.js';

// Enforce endurance, pet ownership, selected hammer variants, and timed weapon
// flips before allowing a core Ranger cast; shared code owns chain ordering.
export function rangerCoreCastAvailability(context: RangerPrecastContext, skill: RangerSkill): AvailabilityResult {
  const state = professionCoreState(context);
  if (skill.id === ID.DODGE) {
    const cost = balanceProfileValueFromContext(context, PROFILE.resources, 'resourceCost', 50);
    return state.endurance + context.epsilon >= cost
      ? { ready: true }
      : {
          ready: false,
          retryAt: rangerEnduranceReadyAt(context, cost),
          code: 'ranger.endurance',
          reason: `Dodge requires ${cost} endurance.`
        };
  }

  if (skill.id === ID.PET_SWAP && !state.petActive) {
    return denySkillCast(skill, 'ranger.pet-inactive', 'the active specialization has replaced the pet.');
  }

  if (
    isRangerHammerVariant(skill.id) &&
    !normalizeRangerHammerSkillIds(context.config.selectedHammerSkillIds).includes(Number(skill.id))
  ) {
    return denySkillCast(skill, 'ranger.hammer-variant-not-selected', 'select this Hammer variant first.');
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
    return denySkillCast(skill, 'ranger.flip-inactive', `use ${flipParent?.name || 'its opening weapon skill'} first.`);
  }

  if (
    skill.type === 'Weapon' &&
    !isRangerHammerVariant(skill.id) &&
    ((skill.flipSkillId != null &&
      skill.flipSkillId !== skill.nextChainId &&
      Number(state.availableFlips[Number(skill.flipSkillId)] || 0) > context.start) ||
      (spearStealthFlipId != null && Number(state.availableFlips[spearStealthFlipId] || 0) > context.start))
  ) {
    return denySkillCast(skill, 'ranger.flip-active', 'use or wait out the active follow-up skill.');
  }

  if (!skill.petSkill) return { ready: true };
  if (skill.petAutonomousSkill) {
    return denySkillCast(skill, 'ranger.pet-autonomous', 'the active pet uses this skill automatically.');
  }

  if (!state.petActive) {
    return denySkillCast(skill, 'ranger.pet-inactive', 'the active specialization has replaced the pet.');
  }

  if (!state.activePetSkillIds.includes(skill.id)) {
    return denySkillCast(skill, 'ranger.inactive-pet', 'select the pet that owns this Beast skill.');
  }

  return { ready: true };
}
