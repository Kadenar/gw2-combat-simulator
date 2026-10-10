import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** A selected Improvisation grants the second use before the stored choice is locked. */
export function improvisationStolenUses(context: unknown): number {
  return hasTrait(context, TRAIT.IMPROVISATION)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.IMPROVISATION), 'maximumStacks')
    : 1;
}

/** Apply the selected shadow-force gain at the existing Siphon resource boundary. */
export function improvisationShadowForceMultiplier(runtime: MechanicQueriesOf<ThiefRuntime>): number {
  return hasTrait(runtime, TRAIT.IMPROVISATION)
    ? 1 + balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.IMPROVISATION), 'lifeForceGain')
    : 1;
}

/** Only Swipe pilfers receive Improvisation's extra use. */
export function improvisationArtifactUses(runtime: ThiefRuntime, source: string): number {
  return source === 'swipe' && hasTrait(runtime, TRAIT.IMPROVISATION)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.IMPROVISATION), 'resourceGain')
    : 0;
}
