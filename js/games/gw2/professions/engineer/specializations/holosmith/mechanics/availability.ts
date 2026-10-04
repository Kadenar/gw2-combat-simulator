import { denySkillCast as denyEngineerCast } from '#gw2/platform/execution/availability.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { NON_HOLOSMITH_SWORD_SKILL_IDS } from '#gw2/professions/engineer/data/module-data.js';
import { HOLOSMITH_FORGE_TOGGLE_SKILL_IDS } from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { crystalStormAvailability } from '#gw2/professions/engineer/specializations/holosmith/traits/behavior.js';
import type { HolosmithSkill } from '#gw2/professions/engineer/specializations/holosmith/types.js';
import type { EngineerRuntime } from '#gw2/professions/engineer/types.js';

/** Enforces Holosmith sword replacement, Forge bar state, overheat, and kit-lockout cast rules. */
export function holosmithCastAvailability(
  context: EngineerRuntime<HolosmithSkill>,
  skill: HolosmithSkill
): AvailabilityResult {
  if (context.config.specialization !== 'Holosmith') return { ready: true };
  // Holosmith replaces the shared Weaponmaster sword IDs with heat-aware variants.
  if (NON_HOLOSMITH_SWORD_SKILL_IDS.has(Number(skill.id))) {
    return denyEngineerCast(skill, 'engineer.holosmith-sword-replaced', 'Holosmith replaces this sword skill.');
  }

  const state = holosmithState.from(context);
  const storm = crystalStormAvailability(context, skill);
  if (!storm.ready) return storm;

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
  if (skill.kitTransition === 'equip' && context.time < (state.kitLockoutUntil || 0)) {
    return denyEngineerCast(
      skill,
      'engineer.kit-lockout',
      'kits are disabled briefly after entering Photon Forge.',
      state.kitLockoutUntil
    );
  }

  return { ready: true };
}
