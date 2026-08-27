import { holosmithState } from './state.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { denySkillCast as denyEngineerCast } from '../../../lib/availability.js';
import type { AvailabilityResult } from '../../../../platform/engine/types.js';
import type { EngineerPrecastContext } from '../../types.js';
import type { HolosmithSkill } from './types.js';

const NON_HOLOSMITH_SWORD_SKILL_IDS = new Set([
  ID.RADIANT_ARC_ID_69565,
  ID.SUN_RIPPER_ID_69906,
  ID.SUN_EDGE_ID_70514,
  ID.GLEAM_SABER_ID_70771,
  ID.REFRACTION_CUTTER_ID_71121
]);

export function holosmithCastAvailability(context: EngineerPrecastContext, skill: HolosmithSkill): AvailabilityResult {
  if (context.config.specialization !== 'Holosmith') return { ready: true };
  // Holosmith replaces the shared Weaponmaster sword IDs with heat-aware variants.
  if (NON_HOLOSMITH_SWORD_SKILL_IDS.has(Number(skill.id))) {
    return denyEngineerCast(skill, 'engineer.holosmith-sword-replaced', 'Holosmith replaces this sword skill.');
  }

  const state = holosmithState.from(context);
  if (skill.forgeSkill && skill.slot === 'Weapon_1') {
    const stormSelected = hasTrait(context.config, TRAIT.CRYSTAL_CONFIGURATION_STORM);
    const stormSkill = skill.name.endsWith('—Storm');
    if (stormSelected !== stormSkill) {
      return denyEngineerCast(
        skill,
        'engineer.forge-auto-replaced',
        stormSelected ? 'Crystal Configuration: Storm replaces this attack.' : 'requires Crystal Configuration: Storm.'
      );
    }
  }

  if (skill.forgeSkill) {
    // Allow the auto-attack chain to complete at the exact overheat timestamp.
    // The chain skill is already queued before the overheat fires, so the forge
    // is technically inactive but the animation was committed.
    const queuedChainAfterOverheat =
      skill.slot === 'Weapon_1' &&
      state.overheated &&
      Math.abs(context.start - Number(state.forgeExitedAt || 0)) <= Number(context.epsilon || 0.0001);
    if (!state.photonForgeActive && !queuedChainAfterOverheat) {
      return denyEngineerCast(skill, 'engineer.forge-inactive', 'enter Photon Forge first.');
    }
  } else if (skill.type === 'Weapon' && state.photonForgeActive) {
    return denyEngineerCast(skill, 'engineer.weapon-bar-replaced', 'Photon Forge replaces weapon skills.');
  }

  if (skill.name === 'Engage Photon Forge') {
    if (state.photonForgeActive) {
      return denyEngineerCast(skill, 'engineer.forge-active', 'Photon Forge is already active.');
    }

    if (state.overheated || state.heat >= state.maximumHeat) {
      return denyEngineerCast(skill, 'engineer.overheated', 'Photon Forge remains disabled until heat reaches zero.');
    }
  }

  if (skill.name.startsWith('Deactivate Photon Forge') && !state.photonForgeActive) {
    return denyEngineerCast(skill, 'engineer.forge-inactive', 'Photon Forge is not active.');
  }

  // Kits use Photon Forge's six-second base recharge lockout after entry. The
  // stored ready time already includes recharge modifiers such as Alacrity.
  if (skill.handlerId === 'engineer.kit-equip' && context.start < Number(state.kitLockoutUntil || 0)) {
    return denyEngineerCast(
      skill,
      'engineer.kit-lockout',
      'kits are disabled briefly after entering Photon Forge.',
      state.kitLockoutUntil
    );
  }

  return { ready: true };
}
