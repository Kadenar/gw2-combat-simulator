import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { timedEffectState, type EffectState } from '#gw2/platform/combat/effect-state.js';
import { activeStackCount, addTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import type { ReadonlyMechanicState } from '#gw2/platform/profession-definition/runtime-context.js';
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

/** Reject overflow against all live Carapace so capped grants never replace or refresh existing stacks. */
export function addCarapace(
  context: NecromancerRuntime | NecromancerResolverContext,
  stacks: number,
  at: number,
  duration: number
): void {
  const state = professionCoreState(context);
  purgeTimedState(state, at);
  const available = Math.max(0, carapaceCapacity(context) - deathCarapaceStacks(context, state, at));
  state.carapaceExpiries = addTimedStacks(
    state.carapaceExpiries,
    Math.min(stacks, available),
    at,
    duration,
    carapaceCapacity(context)
  ).expiries;
}

/** Count active and minion-backed Carapace without mutating either lifetime owner. */
export function deathCarapaceStacks(
  context: unknown,
  state: ReadonlyMechanicState<Partial<NecromancerCoreState>>,
  at: number
): number {
  // Attribute reads count live stacks without rebuilding or mutating the runtime pool.
  const timedCarapace = activeStackCount(state.carapaceExpiries || [], at);
  return Math.min(carapaceCapacity(context), timedCarapace + minionCarapaceStacks(context, state));
}

/** Analysis observes the combat-owned deadlines and living minions, so reporting never grants extra Carapace. */
export function deathCarapaceEffectState(
  context: unknown,
  state: ReadonlyMechanicState<Partial<NecromancerCoreState>>
): EffectState {
  return timedEffectState(
    'necromancer-deaths-carapace',
    [
      ...(state.carapaceExpiries || []).map((expiresAt) => ({
        stacks: 1,
        expiresAt: Number.isFinite(expiresAt) ? expiresAt : null
      })),
      { stacks: minionCarapaceStacks(context, state), expiresAt: null }
    ],
    carapaceCapacity(context),
    { name: "Death's Carapace" }
  );
}

/** Persistent stacks follow the live minion count for both gameplay and analysis. */
function minionCarapaceStacks(context: unknown, state: ReadonlyMechanicState<Partial<NecromancerCoreState>>): number {
  return hasTrait(context, TRAIT.FLESH_OF_THE_MASTER)
    ? Object.values(state.activeMinions || {}).reduce(
        (total: number, count: number) =>
          total + (count || 0) * balanceNumberFromContext(context, TRAIT.FLESH_OF_THE_MASTER, 'resourceGain'),
        0
      )
    : 0;
}

/** Minion-owned strikes sample Necromantic Corruption before applying other creature multipliers. */
export function necromanticCorruptionMultiplier(runtime: NecromancerRuntime): number {
  return hasTrait(runtime, TRAIT.NECROMANTIC_CORRUPTION)
    ? balanceNumberFromContext(runtime, TRAIT.NECROMANTIC_CORRUPTION, 'damageMultiplier')
    : 1;
}
