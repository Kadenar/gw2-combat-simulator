import { resourceDepletionAt } from '#gw2/platform/combat/resources/clock.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import { nextNecromancerPassiveGain } from '#gw2/professions/necromancer/core/mechanics/passives.js';
import type { NecromancerRuntime, NecromancerUiContext } from '#gw2/professions/necromancer/types.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';

/** Wake that ends a draining shroud once life force runs out; the Core hooks own its task handler. */
export const DEPLETION = 'necromancer.life-force-depleted';

/** Every gain or rate change replaces the prior depletion wake; obsolete generations cannot end a later shroud. */
function refreshDepletion(runtime: NecromancerRuntime): void {
  const state = runtime.profession.core;
  runtime.cancelOwner({ id: DEPLETION, generation: state.lifeForceWakeGeneration });
  state.lifeForceWakeGeneration++;
  const at = gw2CooldownReadyAt(resourceDepletionAt(state.lifeForce));

  if (Number.isFinite(at))
    runtime.schedule(DEPLETION, at, null, { id: DEPLETION, generation: state.lifeForceWakeGeneration }, -300);
}

/** Life force drains while a non-Lich shroud is active; readiness waits for passive gains or the current cast. */
export const necromancerLifeForce: ResourcePolicy<NecromancerRuntime> = {
  kind: 'continuous',
  state: (runtime) => runtime.profession.core.lifeForce,
  maximum(context: NecromancerRuntime | NecromancerUiContext) {
    // Live and projected pools expose points; an uninitialized starting control exposes only percentages.
    const live = readProfessionCoreState<NecromancerCoreState>(context.profession).lifeForce;
    const projected = 'professionState' in context ? context.professionState?.lifeForce : undefined;
    return (live ?? projected)?.maximum ?? 100;
  },
  initial: (runtime, maximum) => ((runtime.config.initialResource ?? 100) * maximum) / 100,
  recovery(runtime) {
    const state = runtime.profession.core;
    return state.activeShroud && state.activeShroud !== 'lich'
      ? (-state.lifeForce.maximum *
          balanceNumberFromContext(runtime, state.activeShroudProfileId || PROFILE.shroud, 'lifeForceDrain')) /
          100
      : 0;
  },
  depletion: { refresh: refreshDepletion, stop: refreshDepletion },
  nextChange(runtime, cost) {
    if (cost > runtime.profession.core.lifeForce.maximum) return Infinity;

    // An overlapping request can await the already accepted cast lane; intervening hits decide the actual gain.
    const completion = runtime.castController.currentLaneEnd();
    return Math.min(nextNecromancerPassiveGain(runtime, cost), completion > runtime.time ? completion : Infinity);
  }
};
