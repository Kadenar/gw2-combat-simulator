import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { replaceThiefBuff } from '#gw2/professions/thief/core/mechanics/buffs.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Applies Fluid Strikes at its established mechanical boundary. */
export function applyFluidStrikes(runtime: ThiefRuntime): void {
  if (hasTrait(runtime, TRAIT.FLUID_STRIKES))
    replaceThiefBuff(
      runtime,
      'fluid-strikes',
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.FLUID_STRIKES), 'durationMultiplier'),
      TRAIT.FLUID_STRIKES,
      'Fluid Strikes',
      'Trait'
    );
}

/** Applies Hard to Catch at its established mechanical boundary. */
export function applyHardToCatch(runtime: ThiefRuntime): void {
  if (hasTrait(runtime, TRAIT.HARD_TO_CATCH)) {
    const enduranceGain = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, TRAIT.HARD_TO_CATCH),
      'resourceGain'
    );
    if (enduranceGain > 0) runtime.endurance.grant(enduranceGain);
  }
}

/** Upper Hand claims its cooldown when a dodge completes, before its initiative can re-enter the trait. */
export function applyUpperHand(runtime: ThiefRuntime): void {
  if (!hasTrait(runtime, TRAIT.UPPER_HAND)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.UPPER_HAND);
  if (runtime.procs.claimCooldown(TRAIT.UPPER_HAND, runtime.time, balanceProfileNumber(profile, 'internalCooldown'))) {
    const initiativeGain = balanceProfileNumber(profile, 'resourceGain');
    if (initiativeGain > 0) runtime.resourceController.grant('initiative', initiativeGain);
  }
}
