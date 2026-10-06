import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { weaponFlipBlock } from '#gw2/platform/execution/skill-flips.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';
import {
  isRangerHammerVariant,
  rangerHammerSkillIds,
  rangerHammerUsesBuildSelection
} from '#gw2/professions/ranger/data/hammer-variants.js';
import { rangerPetSkillCommandable } from '#gw2/professions/ranger/data/pet-commands.js';

import {
  RANGER_SPEAR_STEALTH_FLIP_BY_PARENT,
  rangerSpearStealthAvailable
} from '#gw2/professions/ranger/core/mechanics/weapon-state.js';

// Enforce endurance, pet ownership, selected hammer variants, and timed weapon
// flips before allowing a core Ranger cast; shared code owns chain ordering.
export function rangerCoreCastAvailability(
  context: MechanicQueriesOf<RangerRuntime>,
  skill: RangerSkill
): AvailabilityResult {
  const state = professionCoreState(context);
  if (skill.id === ID.PET_SWAP && !state.petActive) {
    return denySkillCast(skill, 'ranger.pet-inactive', 'the active specialization has replaced the pet.');
  }

  if (
    isRangerHammerVariant(skill.id) &&
    !rangerHammerSkillIds({ config: context.config, professionState: context.profession }).includes(Number(skill.id))
  ) {
    if (!rangerHammerUsesBuildSelection(context))
      return denySkillCast(
        skill,
        'ranger.hammer-unleash-state',
        'use the Hammer variant for the current unleashed state.'
      );
    return denySkillCast(skill, 'ranger.hammer-variant-not-selected', 'select this Hammer variant first.');
  }

  const spearStealthFlipId = RANGER_SPEAR_STEALTH_FLIP_BY_PARENT[Number(skill.id)];
  const isSpearStealthAttack = Object.values(RANGER_SPEAR_STEALTH_FLIP_BY_PARENT).includes(Number(skill.id));
  // Spear choices can come from any stealth source; do not misidentify the base attack as their prerequisite.
  if (isSpearStealthAttack || spearStealthFlipId != null) {
    const available = rangerSpearStealthAvailable(state, context.time);
    if (isSpearStealthAttack && !available)
      return denySkillCast(skill, 'ranger.flip-inactive', "use Panther's Prowl or gain stealth first.");
    if (!isSpearStealthAttack && available)
      return denySkillCast(skill, 'ranger.flip-active', 'use or wait out the active stealth attack.');
    return { ready: true };
  }

  // Hammer variants follow loadout or unleash state, so they never require a follow-up window.
  const flipBlock = isRangerHammerVariant(skill.id)
    ? null
    : weaponFlipBlock(state.availableFlips, context.helpers.skillsById, skill, context.time);
  if (flipBlock?.kind === 'closed')
    return denySkillCast(
      skill,
      'ranger.flip-inactive',
      `use ${flipBlock.parent.name || 'its opening weapon skill'} first.`
    );
  if (flipBlock?.kind === 'open')
    return denySkillCast(skill, 'ranger.flip-active', 'use or wait out the active follow-up skill.');

  if (!skill.petSkill) return { ready: true };
  if (!rangerPetSkillCommandable(skill, context.config.specialization || 'Core')) {
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
