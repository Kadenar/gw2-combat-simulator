import { timedEffectState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import {
  harbingerState,
  harbingerBlightMaximum
} from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

/** Register Harbinger's effect rules only when its module is selected. */
export function harbingerBuffPolicies(): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'meltdown', maximumStacks: 1 },
    { kind: 'implacable-foe', maximumStacks: 1 },
    { kind: 'harbinger-shroud', maximumStacks: 1 },
    { kind: 'harbinger-blight' }
  ];
  return policies;
}

/** Observe the retained Blight pools and shroud flags used by combat. */
export function harbingerEffectStates(runtime: MechanicQueriesOf<NecromancerRuntime>): EffectState[] {
  const state = harbingerState.from(runtime);
  return [
    timedEffectState(
      'harbinger-blight',
      state.blightExpiries.map((expiresAt) => ({ expiresAt, stacks: 1 })),
      harbingerBlightMaximum(runtime),
      { name: 'Blight' }
    ),
    timedEffectState(
      'harbinger-shroud',
      runtime.profession.core.activeShroud ? [{ stacks: 1, expiresAt: null }] : [],
      1,
      { name: 'Harbinger Shroud' }
    ),
    timedEffectState('meltdown', [{ stacks: 1, expiresAt: state.meltdownUntil }], 1)
  ];
}
