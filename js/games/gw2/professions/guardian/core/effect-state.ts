import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { timedEffectState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';

import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { balanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

/** Effect owners expose the same selected balance values as combat; presentation supplies no stacking rules. */
export function guardianBuffPolicies(context: unknown): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'illuminated', maximumStacks: 1 },
    { kind: 'guardian-spear-luminance', maximumStacks: 1 },
    { kind: 'guardian-symbol-of-ignition-field', maximumStacks: 1 },
    { kind: 'symbol-duration-extension', maximumStacks: 1 },
    { kind: 'guardian-inspiring-virtue', maximumStacks: 1 }
  ];
  const profile = balanceProfileFromContext(context, TRAIT.SYMBOLIC_AVENGER);
  if (profile)
    policies.push({ kind: 'symbolic-avenger', maximumStacks: balanceProfileNumber(profile, 'maximumStacks') });

  return policies;
}

/** Core observes only its own live stacks; selected elites supply their separate effect pools. */
export function guardianEffectStates(
  runtime: MechanicQueriesOf<MechanicContext<GuardianRuntimeState, GuardianSkill>>
): EffectState[] {
  const core = runtime.profession.core;
  const effects = [
    timedEffectState(
      'symbolic-avenger',
      core.symbolicAvengerExpirations.map((expiresAt) => ({ expiresAt, stacks: 1 })),
      balanceProfileNumber(balanceProfileFromContext(runtime, TRAIT.SYMBOLIC_AVENGER)!, 'maximumStacks')
    )
  ];
  return effects;
}
