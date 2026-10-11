import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

/** Spirits Strength owns the selected creature multiplier; the mechanic samples this pure query. */
export function spiritsStrengthCreatureMultiplier(runtime: MechanicQueriesOf<NecromancerRuntime>): number {
  return hasTrait(runtime, TRAIT.SPIRITS_STRENGTH)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SPIRITS_STRENGTH), 'damageMultiplier')
    : 1;
}

/** Lingering Spirits controls post-shroud lifetime and its continuing resource drain. */
export function lingeringSpiritsActive(runtime: NecromancerRuntime): boolean {
  return hasTrait(runtime, TRAIT.LINGERING_SPIRITS);
}

/** Wielder's Boon grants allied recipients the player's full charge count. */
export function wieldersBoonCharges(runtime: NecromancerRuntime, effect: SkillEffect): number {
  return hasTrait(runtime, TRAIT.WIELDERS_BOON) ? Number(effect.stacks ?? 0) : Number(effect.allyStacks ?? 0);
}
