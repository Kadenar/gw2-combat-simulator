/** Compose Continuum's complete lifecycle with the remaining Chronomancer policies. */
import { timedBuffWindow } from '#gw2/platform/combat/effect-state.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { chronomancerBuffPolicies } from '#gw2/professions/mesmer/specializations/chronomancer/effect-state.js';
import { continuumLifecycle } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/continuum-split.js';
import { chronomancerState } from '#gw2/professions/mesmer/specializations/chronomancer/state.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import { OBSERVABLE_EVENT_HANDLER } from '#kernel/events/handler-registry.js';

export const chronomancerHooks = composeRuntimeHooks<MesmerRuntimeState, MesmerSkill>([
  continuumLifecycle,
  {
    buffPolicies: chronomancerBuffPolicies,
    // Continuum Shift clears the checkpoint before its natural deadline.
    observeEffects: (runtime) => [
      timedBuffWindow(
        'continuum-split',
        'Continuum Split',
        chronomancerState.from(runtime.profession).continuum?.expiresAt ?? 0
      )
    ],
    // Chronomancer strengthens permanent player Alacrity without changing summon recharge or base work.
    playerAlacrityRechargeRate: 1.5,
    eventHandlers: { 'mesmer.phantasm-resummoned': OBSERVABLE_EVENT_HANDLER }
  }
]);
