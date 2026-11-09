/** Compose Continuum's complete lifecycle with the remaining Chronomancer policies. */
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { chronomancerBuffPolicies } from '#gw2/professions/mesmer/specializations/chronomancer/effect-state.js';
import { continuumLifecycle } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/continuum-split.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

export const chronomancerHooks = composeRuntimeHooks<MesmerRuntimeState, MesmerSkill>([
  continuumLifecycle,
  {
    buffPolicies: chronomancerBuffPolicies,
    // Chronomancer strengthens permanent player Alacrity without changing summon recharge or base work.
    playerAlacrityRechargeRate: 1.5,
    eventHandlers: { 'mesmer.phantasm-resummoned': OBSERVABLE_EVENT_HANDLER }
  }
]);
