import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { ENGINEER_SKILL_IDS as ID } from '../data/ids.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS, engineerBalanceValue } from './profiles.js';
import { engineerEnduranceReadyAt } from './resources.js';
import { denySkillCast as denyEngineerCast } from '../../lib/availability.js';
import type { AvailabilityResult } from '../../../platform/engine/types.js';
import type { EngineerConfig, EngineerPrecastContext, EngineerSkill } from '../types.js';

// config.selectedSkills can be an array of names or a slot-keyed object; both normalize to a Set<string>
export function selectedEngineerSkillNames(config: EngineerConfig): Set<string> {
  const source = config.selectedSkills || [];
  return new Set((Array.isArray(source) ? source : Object.values(source)).map(String));
}

export function engineerCoreCastAvailability(
  context: EngineerPrecastContext,
  skill: EngineerSkill
): AvailabilityResult {
  const state = professionCoreState(context);
  const specialization = String(context.config.specialization || 'Core');
  if (skill.id === ID.DODGE) {
    const enduranceCost = engineerBalanceValue(
      context,
      ENGINEER_CORE_BALANCE_PROFILE_IDS.resources,
      'resourceCost',
      50
    );
    // epsilon prevents floating-point rounding from blocking a dodge at exactly the threshold
    return Number(state.endurance || 0) + Number(context.epsilon || 0.0001) >= enduranceCost
      ? { ready: true }
      : denyEngineerCast(
          skill,
          'engineer.insufficient-endurance',
          `requires ${enduranceCost} endurance.`,
          engineerEnduranceReadyAt(context, enduranceCost)
        );
  }

  if (skill.name === 'Electric Artillery' && !state.electricArtilleryAvailable) {
    // electricArtilleryReadyAt is set while Lightning Rod is still charging; gate EA until then
    const retryAt = Number(state.electricArtilleryReadyAt || 0);
    return denyEngineerCast(
      skill,
      'engineer.electric-artillery-inactive',
      'Lightning Rod has not finished charging.',
      retryAt > context.start ? retryAt : null
    );
  }

  if (
    skill.name === 'Lightning Rod' &&
    (state.electricArtilleryAvailable || Number(state.electricArtilleryReadyAt || 0) > context.start)
  ) {
    // block re-cast while EA is available OR while the charge window is still open (both share the slot)
    return denyEngineerCast(
      skill,
      'engineer.lightning-rod-active',
      'Electric Artillery currently replaces this skill.',
      Number(state.electricArtilleryExpiresAt || 0) > context.start ? state.electricArtilleryExpiresAt : null
    );
  }

  if (skill.simulatorExcluded) {
    // skills marked simulatorExcluded fire automatically from their parent; manual queuing would double them
    return denyEngineerCast(
      skill,
      'engineer.contextual-skill',
      'this skill activates automatically from its parent skill.'
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

  if (
    skill.specialization &&
    skill.type !== 'Weapon' &&
    // weapon skills are shared across specializations on the weapon bar; only utility/heal/elite are gated
    String(skill.specialization).toLowerCase() !== specialization.toLowerCase()
  ) {
    return denyEngineerCast(skill, 'engineer.wrong-specialization', `requires ${skill.specialization}.`);
  }

  if (skill.kit) {
    if (state.activeKit !== skill.kit) {
      return denyEngineerCast(skill, 'engineer.inactive-kit', `equip ${skill.kit} first.`);
    }
  } else if (skill.type === 'Weapon' && state.activeKit) {
    // active kit completely replaces the weapon bar; baseline weapon skills are inaccessible
    return denyEngineerCast(skill, 'engineer.weapon-bar-replaced', 'the active kit replaces weapon skills.');
  }

  if (skill.handlerId === 'engineer.kit-equip') {
    if (!selectedEngineerSkillNames(context.config).has(skill.kitName || skill.name)) {
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
    skill.handlerId === 'engineer.consume-flip' &&
    // availableFlips is populated by the parent skill's handler; absent = parent hasn't fired yet
    !state.availableFlips?.[skill.id]
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
    !selectedEngineerSkillNames(context.config).has(skill.toolbeltParentName)
  ) {
    return denyEngineerCast(skill, 'engineer.toolbelt-parent', `${skill.toolbeltParentName} is not equipped.`);
  }

  return { ready: true };
}
