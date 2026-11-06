import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';
import type { BalanceProfileSource } from '#gw2/platform/skills/balance-profiles.js';
import { balanceProfile, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

/** Effect owners expose the same selected balance values as combat; presentation supplies no stacking rules. */
export function engineerBuffPolicies(source: BalanceProfileSource): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'engineer-focused', maximumStacks: 1 },
    { kind: 'kinetic-battery', maximumStacks: 1 },
    { kind: 'thermal-vision', maximumStacks: 1 },
    { kind: 'grand-entrance', maximumStacks: 1 }
  ];
  for (const [kind, id] of [['explosive-temper', TRAIT.EXPLOSIVE_TEMPER]] as const) {
    const profile = balanceProfile(source, id);

    if (profile) policies.push({ kind, maximumStacks: balanceProfileNumber(profile, 'maximumStacks') });
  }

  return policies;
}
