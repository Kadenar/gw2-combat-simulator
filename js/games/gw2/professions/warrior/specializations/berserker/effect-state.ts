import { timedEffectState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';

import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

import { berserkerState } from '#gw2/professions/warrior/specializations/berserker/state.js';

/** Only the selected elite contributes its buff caps and observations. */
export function berserkerBuffPolicies(): BuffStatePolicy[] {
  return [
    { kind: 'berserk', maximumStacks: 1 },
    { kind: 'fire-aura', maximumStacks: 1 }
  ];
}

/** Observe live owner state so consumption and expiry agree with combat. */
export function berserkerEffectStates(
  runtime: MechanicQueriesOf<MechanicContext<WarriorRuntimeState, WarriorSkill>>
): EffectState[] {
  const state = berserkerState.from(runtime);
  return [
    timedEffectState('berserk', state.berserkActive ? [{ stacks: 1, expiresAt: state.berserkUntil }] : [], 1),
    timedEffectState('fire-aura', [{ stacks: 1, expiresAt: state.fireAuraUntil }], 1)
  ];
}
