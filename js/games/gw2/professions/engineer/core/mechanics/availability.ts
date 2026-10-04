import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

import { denySkillCast as denyEngineerCast } from '#gw2/platform/execution/availability.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Enforces Core Engineer resource, kit, flip, and toolbelt prerequisites after shared build eligibility. */
export function engineerCoreCastAvailability(
  context: MechanicQueriesOf<EngineerRuntime>,
  skill: EngineerSkill
): AvailabilityResult {
  const state = professionCoreState(context);
  if (skill.id === ID.HEALING_TURRET && state.healingTurretActivationId) {
    return denyEngineerCast(skill, 'engineer.healing-turret-active', 'the deployed turret must be detonated first.');
  }

  const artillery = state.availableFlips[ID.ELECTRIC_ARTILLERY];
  if (skill.id === ID.ELECTRIC_ARTILLERY && !skillFlipReady(artillery, context.time)) {
    // The stored window carries readiness even while its palette tile is hidden.
    const retryAt = artillery?.availableAt || 0;
    return denyEngineerCast(
      skill,
      'engineer.electric-artillery-inactive',
      'Lightning Rod has not finished charging.',
      retryAt > context.time ? retryAt : null
    );
  }

  if (skill.id === ID.LIGHTNING_ROD && artillery && (artillery.expiresAt ?? Infinity) > context.time) {
    // block re-cast while EA is available OR while the charge window is still open (both share the slot)
    return denyEngineerCast(
      skill,
      'engineer.lightning-rod-active',
      'Electric Artillery currently replaces this skill.',
      artillery.expiresAt
    );
  }

  if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) {
    // engineers have no weapon swap except to exit a kit back to baseline weapons
    return state.activeKit
      ? { ready: true }
      : denyEngineerCast(
          skill,
          'engineer.weapon-swap-disabled',
          'engineers can use weapon swap only to leave an active kit.'
        );
  }

  if (skill.kitId) {
    if (state.activeKit !== skill.kitId) {
      return denyEngineerCast(
        skill,
        'engineer.inactive-kit',
        `equip ${context.helpers.skillsById.get(skill.kitId)?.name} first.`
      );
    }
  } else if (skill.type === 'Weapon' && state.activeKit) {
    // active kit completely replaces the weapon bar; baseline weapon skills are inaccessible
    return denyEngineerCast(skill, 'engineer.weapon-bar-replaced', 'the active kit replaces weapon skills.');
  }

  if (skill.kitTransition === 'equip') {
    if (
      context.config.selectedSkillIds !== undefined &&
      !selectedSkillIdSet(context.config.selectedSkillIds).has(skill.id)
    ) {
      return denyEngineerCast(skill, 'engineer.kit-not-equipped', 'the kit is not selected in a slot.');
    }

    if (state.activeKit === skill.id) {
      return denyEngineerCast(skill, 'engineer.kit-active', `use Stow ${skill.name} to leave this kit.`);
    }
  }

  if (
    skill.requiresArmedFlip &&
    // availableFlips is populated by the parent skill's handler; absent = parent hasn't fired yet
    !skillFlipReady(state.availableFlips[skill.id], context.time)
  ) {
    return denyEngineerCast(
      skill,
      'engineer.flip-inactive',
      `use ${(skill.flipParentId == null ? undefined : context.helpers.skillsById.get(skill.flipParentId)?.name) || 'its parent skill'} first.`
    );
  }

  // Parent relationships use IDs; the selected loadout preserves canonical identity.
  const parent = skill.toolbeltParentId == null ? undefined : context.helpers.skillsById.get(skill.toolbeltParentId);
  if (
    context.config.selectedSkillIds !== undefined &&
    skill.toolbeltParentId &&
    skill.countsAsToolbeltSkill !== false &&
    (!parent || !selectedSkillIdSet(context.config.selectedSkillIds).has(parent.id))
  ) {
    return denyEngineerCast(skill, 'engineer.toolbelt-parent', `${parent?.name ?? 'Parent skill'} is not equipped.`);
  }

  return { ready: true };
}
