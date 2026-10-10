import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;

/** Wings retains live base effects and the weapon selected at acceptance before materialization. */
export const soaringDevastationEffects: NonNullable<Skill['effectVariants']>[number] = {
  when: (runtime) => hasTrait(runtime, TRAIT.SOARING_DEVASTATION),
  profileId: TRAIT.SOARING_DEVASTATION,
  transform: (runtime, cast, effects) => [
    ...(cast.skill.effects ?? []),
    ...effects
      .filter((effect) => effect.type === 'strike' || effect.type === 'condition')
      .map((effect) => ({
        ...effect,
        name:
          effect.type === 'strike'
            ? 'Wings of Resolve \u2014 Soaring Devastation'
            : 'Soaring Devastation \u2014 Immobilized',
        weapon: gw2ActivePrimaryWeapon(runtime.config, runtime.activeWeaponSet),
        timingAnchor: 'castEnd' as const
      }))
  ]
};

/** Justice owns the tether lifecycle; this trait selects only the active tether's duration. */
export function bigGameHunterTetherDuration(runtime: Runtime, baseDuration: number): number {
  return hasTrait(runtime, TRAIT.BIG_GAME_HUNTER)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.BIG_GAME_HUNTER), 'pulseInterval')
    : baseDuration;
}
