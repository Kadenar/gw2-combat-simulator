import { timedEffectState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { balanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

/** Register Catalyst's effect rules only when its module is selected. */
export function catalystBuffPolicies(context: unknown): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'relentless fire', maximumStacks: 1 },
    { kind: 'shattering ice', maximumStacks: 1 }
  ];
  const elementalEmpowerment = balanceProfileFromContext(context, TRAIT.ELEMENTAL_EMPOWERMENT);
  if (elementalEmpowerment)
    policies.push({
      kind: 'elemental empowerment',
      maximumStacks: balanceProfileNumber(elementalEmpowerment, 'maximumStacks')
    });
  const empoweringAuras = balanceProfileFromContext(context, TRAIT.EMPOWERING_AURAS);
  if (empoweringAuras)
    policies.push({ kind: 'empowering auras', maximumStacks: balanceProfileNumber(empoweringAuras, 'maximumStacks') });
  return policies;
}

/** Observe the same empowerment expiries combat mutates, retaining selected-profile caps and exact expiry. */
export function catalystEffectStates(runtime: MechanicQueriesOf<ElementalistRuntime>): EffectState[] {
  return [
    timedEffectState(
      'elemental empowerment',
      catalystState.from(runtime).elementalEmpowermentExpiries.map((expiresAt) => ({ expiresAt, stacks: 1 })),
      balanceProfileNumber(balanceProfileFromContext(runtime, TRAIT.ELEMENTAL_EMPOWERMENT)!, 'maximumStacks')
    )
  ];
}
