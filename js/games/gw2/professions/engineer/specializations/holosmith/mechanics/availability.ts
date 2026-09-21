import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { denySkillCast as denyEngineerCast } from '#gw2/professions/shared/availability.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { EngineerPrecastContext } from '#gw2/professions/engineer/types.js';
import type { HolosmithSkill } from '#gw2/professions/engineer/specializations/holosmith/types.js';
import {
  HOLOSMITH_FORGE_TOGGLE_SKILL_IDS,
  HOLOSMITH_STORM_AUTOATTACK_SKILL_IDS
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';

const NON_HOLOSMITH_SWORD_SKILL_IDS = new Set([
  ID.RADIANT_ARC_ID_69565,
  ID.SUN_RIPPER_ID_69906,
  ID.SUN_EDGE_ID_70514,
  ID.GLEAM_SABER_ID_70771,
  ID.REFRACTION_CUTTER_NON_HOLOSMITH
]);

/** Enforces Holosmith sword replacement, Forge bar state, overheat, and kit-lockout cast rules. */
export function holosmithCastAvailability(context: EngineerPrecastContext, skill: HolosmithSkill): AvailabilityResult {
  if (context.config.specialization !== 'Holosmith') return { ready: true };
  // Holosmith replaces the shared Weaponmaster sword IDs with heat-aware variants.
  if (NON_HOLOSMITH_SWORD_SKILL_IDS.has(Number(skill.id))) {
    return denyEngineerCast(skill, 'engineer.holosmith-sword-replaced', 'Holosmith replaces this sword skill.');
  }

  const state = holosmithState.from(context);
  if (skill.forgeSkill && skill.slot === 'Weapon_1') {
    const stormSelected = hasTrait(context.config, TRAIT.CRYSTAL_CONFIGURATION_STORM);
    const stormSkill = HOLOSMITH_STORM_AUTOATTACK_SKILL_IDS.has(Number(skill.id));
    if (stormSelected !== stormSkill) {
      return denyEngineerCast(
        skill,
        'engineer.forge-auto-replaced',
        stormSelected ? 'Crystal Configuration: Storm replaces this attack.' : 'requires Crystal Configuration: Storm.'
      );
    }
  }

  if (skill.forgeSkill) {
    // Exhaustion blocks new attacks, including autoattack chains, while the explicit exit remains available.
    if (state.overheated) {
      return denyEngineerCast(skill, 'engineer.overheated', 'exit Photon Forge and let heat reach zero.');
    }

    if (!state.photonForgeActive) {
      return denyEngineerCast(skill, 'engineer.forge-inactive', 'enter Photon Forge first.');
    }
  } else if (skill.type === 'Weapon' && state.photonForgeActive) {
    return denyEngineerCast(skill, 'engineer.weapon-bar-replaced', 'Photon Forge replaces weapon skills.');
  }

  if (skill.id === ID.ENGAGE_PHOTON_FORGE) {
    if (state.photonForgeActive) {
      return denyEngineerCast(skill, 'engineer.forge-active', 'Photon Forge is already active.');
    }

    if (state.overheated || state.heat >= state.maximumHeat) {
      return denyEngineerCast(skill, 'engineer.overheated', 'Photon Forge remains disabled until heat reaches zero.');
    }
  }

  if (
    HOLOSMITH_FORGE_TOGGLE_SKILL_IDS.has(Number(skill.id)) &&
    skill.id !== ID.ENGAGE_PHOTON_FORGE &&
    !state.photonForgeActive
  ) {
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
