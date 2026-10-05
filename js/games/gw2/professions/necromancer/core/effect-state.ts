import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { timedEffectState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';

import type { NecromancerRuntimeState, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Core owns shared weapon and trait effects; selected elites register their own policies. */
export function necromancerBuffPolicies(_context: unknown): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'necromancer-soul-barbs', maximumStacks: 1 },
    { kind: 'extirpation' },
    { kind: 'taste-for-blood' }
  ];
  return policies;
}

/** Record Core's consumed recipient grants directly from their retained windows. */
export function necromancerEffectStates(
  runtime: MechanicQueriesOf<MechanicContext<NecromancerRuntimeState, NecromancerSkill>>
): EffectState[] {
  const core = runtime.profession.core;
  const effects: EffectState[] = Object.entries(core.tasteForBloodGrants).map(([recipient, windows]) =>
    timedEffectState(
      'taste-for-blood',
      windows.map((grant) => ({ stacks: grant.charges, expiresAt: grant.expiresAt })),
      null,
      { recipient }
    )
  );
  if (!effects.some((effect) => effect.recipient === 'self')) effects.push(timedEffectState('taste-for-blood', []));
  return effects;
}
