import { type BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';

import { balanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

/** Effect owners expose the same selected balance values as combat; presentation supplies no stacking rules. */
export function warriorBuffPolicies(context: unknown): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'signet-of-fury-active', maximumStacks: 1 },
    { kind: 'peak-performance', maximumStacks: 1 },
    { kind: 'burst-precision', maximumStacks: 1 }
  ];
  for (const [kind, id] of [
    ['signet-mastery', TRAIT.SIGNET_MASTERY],
    ['berserkers-power', TRAIT.BERSERKERS_POWER],
    ['furious-surge', TRAIT.FURIOUS]
  ] as const) {
    const profile = balanceProfileFromContext(context, id);
    if (profile) policies.push({ kind, maximumStacks: balanceProfileNumber(profile, 'maximumStacks') });
  }

  return policies;
}
