import { timedEffectState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { BalanceProfileSource } from '#gw2/platform/skills/balance-profiles.js';
import { balanceNumber, balanceProfile, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { spellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import type { WarriorRuntime } from '#gw2/professions/warrior/types.js';

/** Only the selected elite contributes its buff caps and observations. */
export function spellbreakerBuffPolicies(source: BalanceProfileSource): BuffStatePolicy[] {
  return [
    { kind: 'magebane-tether', maximumStacks: 1 },
    {
      kind: 'attackers-insight',
      maximumStacks: balanceNumber(source, TRAIT.ATTACKERS_INSIGHT, 'maximumStacks')
    }
  ];
}

/** Observe live owner state so consumption and expiry agree with combat. */
export function spellbreakerEffectStates(runtime: MechanicQueriesOf<WarriorRuntime>): EffectState[] {
  const state = spellbreakerState.from(runtime.profession);
  return [
    timedEffectState(
      'attackers-insight',
      state.attackerInsightExpiries.map((expiresAt) => ({ expiresAt, stacks: 1 })),
      balanceProfileNumber(balanceProfile(runtime.helpers, TRAIT.ATTACKERS_INSIGHT)!, 'maximumStacks')
    ),
    timedEffectState('magebane-tether', [{ stacks: 1, expiresAt: state.magebaneTetherUntil }], 1)
  ];
}
