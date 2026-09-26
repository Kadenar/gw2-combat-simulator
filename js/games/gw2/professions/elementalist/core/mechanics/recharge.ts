import type { Skill } from '#gw2/platform/engine/skills/types.js';
/**
 * Owns Core Elementalist cross-cast recharge policy and one-shot modifier consumption.
 * Skill fragments declare base cooldowns; persistent systems decide when and how they recharge.
 */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';

import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { skillWeapon } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';

/**
 * Calculates persistent attunement and skill recharge rules without spending
 * next-cast empowerments, including when queried for bulk cooldown reductions.
 */
export function elementalistRechargeWork(
  context: ElementalistRuntime,
  skill: Skill,
  duration: number,
  releasing = false
): number {
  if (!skill) return duration;
  // The summon owns this recharge: `mechanics/elementals/runtime.ts` starts the glyph cooldown
  // when the elemental expires, so the cast itself must not start one.
  if (skill.id === ID.GLYPH_OF_ELEMENTALS) return 0;
  // Rock Barrier holds its recharge until the stored barrier is released; the
  // release handler re-requests the duration with that flag set.
  if (skill.id === ID.ROCK_BARRIER && !releasing) {
    return 0;
  }

  // Everything below is weapon-slot policy; other skill types keep their catalog recharge.
  if (skill.type !== 'Weapon') {
    return duration;
  }

  let adjustedDuration = duration;
  if (skill.id === ID.RIDE_THE_LIGHTNING) {
    const rideTheLightningProfile = requireBalanceProfileFromContext(context, PROFILE.rideTheLightning);
    adjustedDuration *= balanceProfileNumber(rideTheLightningProfile, 'rechargeMultiplier');
  }

  // The four *mancer's Training traits shorten weapon recharges, each only for
  // skills belonging to its own attunement.
  const attunement = String(skill.attunement || '');
  if (
    (attunement === 'Fire' && hasTrait(context, "Pyromancer's Training")) ||
    (attunement === 'Air' && hasTrait(context, "Aeromancer's Training")) ||
    (attunement === 'Earth' && hasTrait(context, "Geomancer's Training")) ||
    (attunement === 'Water' && hasTrait(context, "Aquamancer's Training"))
  ) {
    const profileId =
      attunement === 'Fire'
        ? PROFILE.pyromancersTraining
        : attunement === 'Air'
          ? PROFILE.aeromancersTraining
          : attunement === 'Earth'
            ? PROFILE.geomancersTraining
            : PROFILE.aquamancersTraining;
    const profile = requireBalanceProfileFromContext(context, profileId);
    adjustedDuration *= balanceProfileNumber(profile, 'rechargeMultiplier');
  }

  return adjustedDuration;
}

/** Spends the eligible empowerment when a cast is accepted; its reservation retains the selected duration. */
export function reserveElementalistRecharge(context: ElementalistRuntime, skill: Skill, duration: number): number {
  if (skill.type !== 'Weapon' || String(skill.slot || '') === 'Weapon_1') return duration;
  const state = professionCoreState(context);
  if (state.spearNextRechargeReduction && skillWeapon(skill) === 'Spear') {
    state.spearNextRechargeReduction = false;
    const spearEmpowermentsProfile = requireBalanceProfileFromContext(context, PROFILE.spearEmpowerments);
    return duration * balanceProfileNumber(spearEmpowermentsProfile, 'rechargeMultiplier');
  }

  if (state.dazingDischargeUntil > context.time && skillWeapon(skill) === 'Pistol') {
    state.dazingDischargeUntil = 0;
    const dazingDischargeProfile = requireBalanceProfileFromContext(context, PROFILE.dazingDischarge);
    return duration * balanceProfileNumber(dazingDischargeProfile, 'rechargeMultiplier');
  }

  return duration;
}
