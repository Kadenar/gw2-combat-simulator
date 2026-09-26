import { weaponFlipBlock } from '#gw2/platform/engine/skills/skill-flips.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { denySkillCast } from '#gw2/platform/engine/skills/availability.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';
import { isRangerHammerVariant, normalizeRangerHammerSkillIds } from '#gw2/professions/ranger/data/hammer-variants.js';

import {
  RANGER_SPEAR_STEALTH_FLIP_BY_PARENT,
  rangerSpearStealthAvailable
} from '#gw2/professions/ranger/core/mechanics/weapon-state.js';

// Enforce endurance, pet ownership, selected hammer variants, and timed weapon
// flips before allowing a core Ranger cast; shared code owns chain ordering.
export function rangerCoreCastAvailability(context: RangerRuntime, skill: RangerSkill): AvailabilityResult {
  const state = professionCoreState(context);
  if (skill.id === ID.PET_SWAP && !state.petActive) {
    return denySkillCast(skill, 'ranger.pet-inactive', 'the active specialization has replaced the pet.');
  }

  if (
    isRangerHammerVariant(skill.id) &&
    !normalizeRangerHammerSkillIds(context.config.selectedHammerSkillIds).includes(Number(skill.id))
  ) {
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

  // Hammer variants are loadout choices, not follow-ups, so only other weapon pairs follow the shared slot rule.
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
