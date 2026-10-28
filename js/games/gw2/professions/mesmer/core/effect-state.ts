import { timedEffectState, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';
import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import {
  balanceProfileFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

/** Core owns shared weapon and trait effects; selected elites register their own policies. */
export function mesmerBuffPolicies(context: unknown): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'clarity', maximumStacks: 1 },
    // Aura grants extend one damage-buff window with a patchable remaining-duration cap.
    {
      kind: 'illusionary-membrane',
      maximumStacks: 1,
      maximumDuration: balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.ILLUSIONARY_MEMBRANE),
        'maximumDuration'
      )
    },
    { kind: 'distortion', maximumStacks: 1 }
  ];
  for (const [kind, id] of [
    ['compounding', TRAIT.COMPOUNDING_POWER],
    ['fencer', TRAIT.FENCERS_FINESSE]
  ] as const) {
    const profile = balanceProfileFromContext(context, id);

    if (profile) policies.push({ kind, maximumStacks: balanceProfileNumber(profile, 'maximumStacks') });
  }

  return policies;
}

/** Project the canonical grant so acceptance consumption and exclusive expiry also hide Clarity. */
export function mesmerEffectStates(runtime: MechanicQueriesOf<MechanicContext<MesmerRuntimeState>>): EffectState[] {
  const grant = runtime.profession.core.clarity;
  return [timedEffectState('clarity', [{ stacks: grant.charges, expiresAt: grant.expiresAt }], 1)];
}
