import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

/** Runtime and detached modifier queries resolve Fervor tuning from their selected catalog. */
export function fervorProfile(
  runtime: Pick<RevenantRuntime, 'traits' | 'helpers'> | Gw2ModifierContext
): BalanceProfile {
  return requireBalanceProfileFromContext(
    runtime,
    hasTrait(runtime, TRAIT.LASTING_LEGACY) ? TRAIT.LASTING_LEGACY : TRAIT.AMBUSH_COMMANDER
  );
}

/** The cap is balance configuration, so read it without caching it in mutable profession state. */
export function fervorMaximumStacks(context: Parameters<typeof fervorProfile>[0]): number {
  return Math.max(1, balanceProfileNumber(fervorProfile(context), 'maximumStacks'));
}
