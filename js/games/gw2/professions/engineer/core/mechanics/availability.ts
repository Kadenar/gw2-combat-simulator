import { skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import { EPSILON } from '#kernel/core/clock.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/engineer/core/profiles.js';

import {
  denySkillCast as denyEngineerCast,
  selectedSlotSkillAvailability
} from '#gw2/professions/shared/availability.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Enforces Core Engineer resource, kit, flip, and toolbelt prerequisites after shared build eligibility. */
export function engineerCoreCastAvailability(context: EngineerRuntime, skill: EngineerSkill): AvailabilityResult {
  const selection = selectedSlotSkillAvailability({ config: context.config, catalog: context.helpers }, skill);
  if (selection) return selection;
  const state = professionCoreState(context);
  if (skill.id === ID.DODGE) {
    const resourcesProfile = requireBalanceProfileFromContext(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.resources);
    const enduranceCost = balanceProfileNumber(resourcesProfile, 'resourceCost');
    // epsilon prevents floating-point rounding from blocking a dodge at exactly the threshold
    return Number(state.endurance || 0) + EPSILON >= enduranceCost
      ? { ready: true }
      : denyEngineerCast(
          skill,
          'engineer.insufficient-endurance',
          `requires ${enduranceCost} endurance.`,
          context.endurance.readyAt(enduranceCost)
        );
  }

  if (skill.id === ID.HEALING_TURRET && state.healingTurretActivationId) {
    return denyEngineerCast(skill, 'engineer.healing-turret-active', 'the deployed turret must be detonated first.');
  }

  const artillery = state.availableFlips[ID.ELECTRIC_ARTILLERY];
  if (skill.id === ID.ELECTRIC_ARTILLERY && !skillFlipReady(artillery, context.time)) {
    // The stored window carries readiness even while its palette tile is hidden.
    const retryAt = Number(artillery?.availableAt || 0);
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

  if (skill.id === ID.SWAP_WEAPONS) {
    // engineers have no weapon swap except to exit a kit back to baseline weapons
    return state.activeKit
      ? { ready: true }
      : denyEngineerCast(
          skill,
          'engineer.weapon-swap-disabled',
          'engineers can use weapon swap only to leave an active kit.'
        );
  }

  if (skill.kit) {
    if (state.activeKit !== skill.kit) {
      return denyEngineerCast(skill, 'engineer.inactive-kit', `equip ${skill.kit} first.`);
    }
  } else if (skill.type === 'Weapon' && state.activeKit) {
    // active kit completely replaces the weapon bar; baseline weapon skills are inaccessible
    return denyEngineerCast(skill, 'engineer.weapon-bar-replaced', 'the active kit replaces weapon skills.');
  }

  if (skill.kitTransition === 'equip') {
    if (!selectedSkillNameSet(context.config.selectedSkills).has(skill.kitName || skill.name)) {
      return denyEngineerCast(skill, 'engineer.kit-not-equipped', 'the kit is not selected in a slot.');
    }

    if (state.activeKit === (skill.kitName || skill.name)) {
      return denyEngineerCast(
        skill,
        'engineer.kit-active',
        `use Stow ${skill.kitName || skill.name} to leave this kit.`
      );
    }
  }

  if (
    skill.flipParentName != null &&
    // availableFlips is populated by the parent skill's handler; absent = parent hasn't fired yet
    !skillFlipReady(state.availableFlips[skill.id], context.time)
  ) {
    return denyEngineerCast(
      skill,
      'engineer.flip-inactive',
      `use ${skill.flipParentName || 'its parent skill'} first.`
    );
  }

  if (
    skill.toolbeltParentName &&
    skill.countsAsToolbeltSkill !== false &&
    !selectedSkillNameSet(context.config.selectedSkills).has(skill.toolbeltParentName)
  ) {
    return denyEngineerCast(skill, 'engineer.toolbelt-parent', `${skill.toolbeltParentName} is not equipped.`);
  }

  return { ready: true };
}
