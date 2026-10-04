import { timedEffectState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';

import {
  balanceProfileFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

import { spellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';

/** Only the selected elite contributes its buff caps and observations. */
export function spellbreakerBuffPolicies(context: unknown): BuffStatePolicy[] {
  return [
    { kind: 'magebane-tether', maximumStacks: 1 },
    {
      kind: 'attackers-insight',
      maximumStacks: balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.ATTACKERS_INSIGHT),
        'maximumStacks'
      )
    }
  ];
}

/** Observe live owner state so consumption and expiry agree with combat. */
export function spellbreakerEffectStates(
  runtime: MechanicQueriesOf<MechanicContext<WarriorRuntimeState, WarriorSkill>>
): EffectState[] {
  const state = spellbreakerState.from(runtime);
  return [
    timedEffectState(
      'attackers-insight',
      state.attackerInsightExpiries.map((expiresAt) => ({ expiresAt, stacks: 1 })),
      balanceProfileNumber(balanceProfileFromContext(runtime, TRAIT.ATTACKERS_INSIGHT)!, 'maximumStacks')
    ),
    timedEffectState('magebane-tether', [{ stacks: 1, expiresAt: state.magebaneTetherUntil }], 1)
  ];
}
