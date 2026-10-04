import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { timedEffectState, type EffectState } from '#gw2/platform/combat/effect-state.js';

import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';
import { balanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/engine/skills/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

/** Effect owners expose the same selected balance values as combat; presentation supplies no stacking rules. */
export function mesmerBuffPolicies(context: unknown): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'clarity', maximumStacks: 1 },
    { kind: 'illusionary-membrane', maximumStacks: 1 },
    { kind: 'mirage-mirror', maximumStacks: 1 },
    { kind: 'distortion', maximumStacks: 1 },
    { kind: 'danger-time', maximumStacks: 1 },
    { kind: 'deadly-blades', maximumStacks: 1 },
    { kind: 'mirage-cloak', maximumStacks: 1 },
    { kind: 'altered-chord', maximumStacks: 1 }
  ];
  for (const [kind, id] of [
    ['compounding', TRAIT.COMPOUNDING_POWER],
    ['fencer', TRAIT.FENCERS_FINESSE],
    ['phantom-pain', TRAIT.PHANTOM_PAIN]
  ] as const) {
    const profile = balanceProfileFromContext(context, id);
    if (profile) policies.push({ kind, maximumStacks: balanceProfileNumber(profile, 'maximumStacks') });
  }

  return policies;
}

/** Clarity disappears when a qualifying activation consumes the existing core window. */
export function mesmerEffectStates(runtime: MechanicQueriesOf<MechanicContext<MesmerRuntimeState>>): EffectState[] {
  return [timedEffectState('clarity', [{ stacks: 1, expiresAt: runtime.profession.core.clarityUntil }], 1)];
}
