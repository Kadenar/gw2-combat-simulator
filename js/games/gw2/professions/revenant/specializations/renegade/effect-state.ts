import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { renegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import { timedEffectState, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';

/** Only the selected renegade installs its effect stacking policies. */
export function renegadeBuffPolicies(): BuffStatePolicy[] {
  return [{ kind: 'band-together', maximumStacks: 1 }, { kind: 'razorclaws-rage' }, { kind: 'kallas-fervor' }];
}

/** Observe the owner's live charge pools so consumption and expiry remain visible without Core reading elite state. */
export function renegadeEffectStates(runtime: MechanicQueriesOf<RevenantRuntime>): EffectState[] {
  const state = renegadeState.from(runtime);
  return [
    timedEffectState(
      'kallas-fervor',
      state.kallasFervor.map((application) => ({ expiresAt: application.expiresAt, stacks: 1 })),
      state.kallasFervorMaximumStacks
    ),
    timedEffectState('razorclaws-rage', [
      { stacks: state.razorclawsRage.charges, expiresAt: state.razorclawsRage.expiresAt }
    ]),
    timedEffectState(
      'band-together',
      [{ stacks: state.bandTogether.charges, expiresAt: state.bandTogether.expiresAt }],
      1
    )
  ];
}
