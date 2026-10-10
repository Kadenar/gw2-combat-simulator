import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

/** Applies Smothering Auras' profile-driven duration multiplier once. */
export function smotheringAurasDuration(context: unknown, duration: number): number {
  return hasTrait(context, TRAIT.SMOTHERING_AURAS)
    ? duration *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SMOTHERING_AURAS), 'durationMultiplier')
    : duration;
}
