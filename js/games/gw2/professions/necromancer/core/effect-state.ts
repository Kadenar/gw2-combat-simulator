import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { timedEffectState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';

import type { NecromancerRuntimeState, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Effect owners expose the same selected balance values as combat; presentation supplies no stacking rules. */
export function necromancerBuffPolicies(_context: unknown): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'meltdown', maximumStacks: 1 },
    { kind: 'implacable-foe', maximumStacks: 1 },
    { kind: 'necromancer-painful-bond', maximumStacks: 1 },
    { kind: 'necromancer-soul-barbs', maximumStacks: 1 },
    { kind: 'harbinger-shroud', maximumStacks: 1 },
    { kind: 'extirpation' },
    { kind: 'taste-for-blood' },
    { kind: 'active-shade' },
    { kind: 'harbinger-blight' }
  ];
  return policies;
}

/** Record consumed recipient grants and actual shroud state rather than reconstructing them from announcements. */
export function necromancerEffectStates(
  runtime: MechanicQueriesOf<MechanicContext<NecromancerRuntimeState, NecromancerSkill>>
): EffectState[] {
  const core = runtime.profession.core;
  const effects: EffectState[] = Object.entries(core.tasteForBloodBuffs).map(([recipient, windows]) =>
    timedEffectState('taste-for-blood', windows, null, { recipient })
  );
  if (!effects.some((effect) => effect.recipient === 'self')) effects.push(timedEffectState('taste-for-blood', []));
  const elite = runtime.profession.specialization;
  if (elite.kind === 'Scourge')
    effects.push(
      timedEffectState(
        'active-shade',
        elite.state.shades.map((expiresAt) => ({ expiresAt, stacks: 1 }))
      )
    );
  return effects;
}
