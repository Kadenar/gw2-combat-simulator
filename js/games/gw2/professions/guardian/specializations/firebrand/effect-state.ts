import { timedEffectState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';

/** Only the selected elite supplies its effect policies, using the same caps as its mechanics. */
export function firebrandBuffPolicies(): BuffStatePolicy[] {
  return [{ kind: 'toughness' }, { kind: 'ashes-of-the-just' }];
}

/** Observe the owning pools so consumption, replacement, and expiry agree with combat. */
export function firebrandEffectStates(
  runtime: MechanicQueriesOf<MechanicContext<GuardianRuntimeState, GuardianSkill>>
): EffectState[] {
  const state = firebrandState.from(runtime);
  return [timedEffectState('ashes-of-the-just', [{ stacks: state.ashes.charges, expiresAt: state.ashes.expiresAt }])];
}
