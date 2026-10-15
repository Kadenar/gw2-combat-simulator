import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { activeStackCount, addTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { purgeTimedState } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerResolverContext, NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

/** Timed grants and combined stack queries share the active patch's capacity, even without minion grants selected. */
function carapaceCapacity(context: unknown): number {
  return balanceNumberFromContext(context, TRAIT.FLESH_OF_THE_MASTER, 'maximumStacks');
}

/** Admit timed stacks using their trait-owned capacity while preserving existing expiry and overflow policy. */
export function addCarapace(
  context: NecromancerRuntime | NecromancerResolverContext,
  stacks: number,
  at: number,
  duration: number
): void {
  const state = professionCoreState(context);
  purgeTimedState(state, at);
  state.carapaceExpiries = addTimedStacks(
    state.carapaceExpiries,
    stacks,
    at,
    duration,
    carapaceCapacity(context)
  ).expiries;
}

/** Count active and minion-backed Carapace without mutating either lifetime owner. */
export function deathCarapaceStacks(context: unknown, state: Partial<NecromancerCoreState>, at: number): number {
  // Attribute reads count live stacks without rebuilding or mutating the runtime pool.
  const timedCarapace = activeStackCount(state.carapaceExpiries || [], at);
  const minionCarapace = hasTrait(context, TRAIT.FLESH_OF_THE_MASTER)
    ? Object.values(state.activeMinions || {}).reduce(
        (total: number, count: number) =>
          total + (count || 0) * balanceNumberFromContext(context, TRAIT.FLESH_OF_THE_MASTER, 'resourceGain'),
        0
      )
    : 0;
  return Math.min(carapaceCapacity(context), timedCarapace + minionCarapace);
}

/** Minion-owned strikes sample Necromantic Corruption before applying other creature multipliers. */
export function necromanticCorruptionMultiplier(runtime: NecromancerRuntime): number {
  return hasTrait(runtime, TRAIT.NECROMANTIC_CORRUPTION)
    ? balanceNumberFromContext(runtime, TRAIT.NECROMANTIC_CORRUPTION, 'damageMultiplier')
    : 1;
}
