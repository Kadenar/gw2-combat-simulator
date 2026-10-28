import { timedEffectState, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { renegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import { fervorMaximumStacks } from '#gw2/professions/revenant/specializations/renegade/traits/fervor.js';

/** Only the selected renegade installs its effect stacking policies. */
export function renegadeBuffPolicies(): BuffStatePolicy[] {
  return [{ kind: 'band-together', maximumStacks: 1 }, { kind: 'razorclaws-rage' }, { kind: 'kallas-fervor' }];
}

/** Observe native Fervor and Razorclaw pools; Band Together uses the shared timed-buff observer. */
export function renegadeEffectStates(runtime: MechanicQueriesOf<RevenantRuntime>): EffectState[] {
  const state = renegadeState.from(runtime);
  return [
    timedEffectState(
      'kallas-fervor',
      state.kallasFervor.map((application) => ({ expiresAt: application.expiresAt, stacks: 1 })),
      fervorMaximumStacks(runtime)
    ),
    timedEffectState('razorclaws-rage', [
      { stacks: state.razorclawsRage.charges, expiresAt: state.razorclawsRage.expiresAt }
    ])
  ];
}
