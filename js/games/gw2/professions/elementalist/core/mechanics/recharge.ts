import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import {
  aeromancersTrainingRecharge,
  aquamancersTrainingRecharge,
  geomancersTrainingRecharge,
  pyromancersTrainingRecharge
} from '#gw2/professions/elementalist/core/traits/behavior.js';
/**
 * Owns Core Elementalist cross-cast recharge policy and one-shot modifier consumption.
 * Skill fragments declare base cooldowns; persistent systems decide when and how they recharge.
 */
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { compileRechargeRules } from '#gw2/platform/profession-definition/trigger-rules.js';

import { skillWeapon } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { elementalForGlyphId } from '#gw2/professions/elementalist/core/mechanics/elementals/attacks.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistSkill,
  ElementalistRuntime,
  ElementalistRuntimeState
} from '#gw2/professions/elementalist/types.js';

// Weapon-only reductions share the compiler; delayed recharge and one-use reservations retain their owners.
const weaponRecharge = compileRechargeRules<ElementalistRuntimeState, ElementalistSkill>([
  {
    when: (_context, skill) => skill.id === ID.RIDE_THE_LIGHTNING,
    multiplier: { profile: PROFILE.rideTheLightning, field: 'rechargeMultiplier' }
  }
]);

/**
 * Calculates persistent attunement and skill recharge rules without spending
 * next-cast empowerments, including when queried for bulk cooldown reductions.
 */
export function elementalistRechargeWork(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill,
  duration: number,
  releasing = false
): number {
  // The summon owns this recharge: `mechanics/elementals/runtime.ts` starts the glyph cooldown
  // when the elemental expires, so the cast itself must not start one.
  if (elementalForGlyphId(skill.id)) return 0;
  // Rock Barrier holds its recharge until the stored barrier is released; the
  // release handler re-requests the duration with that flag set.
  if (skill.id === ID.ROCK_BARRIER && !releasing) {
    return 0;
  }

  // Everything below is weapon-slot policy; other skill types keep their catalog recharge.
  if (skill.type !== 'Weapon') {
    return duration;
  }

  let adjusted = weaponRecharge(context, skill, duration);
  adjusted = pyromancersTrainingRecharge(context, skill, adjusted);
  adjusted = aeromancersTrainingRecharge(context, skill, adjusted);
  adjusted = geomancersTrainingRecharge(context, skill, adjusted);
  return aquamancersTrainingRecharge(context, skill, adjusted);
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
