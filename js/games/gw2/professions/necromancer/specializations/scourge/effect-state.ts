import { timedEffectState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NecromancerRuntimeState, NecromancerSkill } from '#gw2/professions/necromancer/types.js';
import { scourgeState } from '#gw2/professions/necromancer/specializations/scourge/state.js';

/** Register Scourge's effect rules only when its module is selected. */
export function scourgeBuffPolicies(): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [{ kind: 'active-shade' }];
  return policies;
}

/** Observe Scourge's retained shade lifetimes so replacement and expiry match combat. */
export function scourgeEffectStates(
  runtime: MechanicQueriesOf<MechanicContext<NecromancerRuntimeState, NecromancerSkill>>
): EffectState[] {
  return [
    timedEffectState(
      'active-shade',
      scourgeState.from(runtime).shades.map((expiresAt) => ({ expiresAt, stacks: 1 }))
    )
  ];
}
