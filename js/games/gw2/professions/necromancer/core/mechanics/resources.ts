import { requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { necromancerShroudDrain } from '#gw2/professions/necromancer/core/mechanics/shroud-tuning.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { nextNecromancerPassiveGain } from '#gw2/professions/necromancer/core/mechanics/passives.js';
import type { NecromancerRuntime, NecromancerUiContext } from '#gw2/professions/necromancer/types.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

/** Wake that ends a draining shroud once life force runs out; the Core hooks own its task handler. */
export const DEPLETION = 'necromancer.life-force-depleted';

/** Life force drains while a non-Lich shroud is active; readiness waits for passive gains or the current cast. */
export const necromancerLifeForce: ResourcePolicy<NecromancerRuntime> = {
  kind: 'continuous',
  state: (runtime) => runtime.profession.core.lifeForce,
  maximum(context: NecromancerRuntime | NecromancerUiContext) {
    // Live and projected pools expose points; an uninitialized starting control exposes only percentages.
    const live = readProfessionCoreState<NecromancerCoreState>(context.profession).lifeForce;
    const projected = 'professionState' in context ? context.professionState?.[STATE.LIFE_FORCE] : undefined;
    return (live ?? projected)?.maximum ?? 100;
  },
  initial: (runtime, maximum) => ((runtime.config.initialResource ?? 100) * maximum) / 100,
  recovery(runtime) {
    const state = runtime.profession.core;
    return state.activeShroud && state.activeShroud !== 'lich'
      ? (-state.lifeForce.maximum *
          necromancerShroudDrain(runtime, requireSkillFromContext(runtime, state.activeShroudEntryId!))) /
          100
      : 0;
  },
  // Shared replacement retains shroud exhaustion before ordinary same-time resource grants.
  depletion: { task: DEPLETION, priority: -300 },
  nextChange(runtime, cost) {
    if (cost > runtime.profession.core.lifeForce.maximum) return Infinity;

    // An overlapping request can await the already accepted cast lane; intervening hits decide the actual gain.
    const completion = runtime.castController.currentLaneEnd();
    return Math.min(nextNecromancerPassiveGain(runtime, cost), completion > runtime.time ? completion : Infinity);
  }
};
