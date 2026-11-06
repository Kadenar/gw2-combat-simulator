import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';
import type { BalanceProfileSource } from '#gw2/platform/skills/balance-profiles.js';
import { balanceProfile, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

/** Register Mirage's effect rules only when its module is selected. */
export function mirageBuffPolicies(source: BalanceProfileSource): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'mirage-mirror', maximumStacks: 1 },
    { kind: 'mirage-cloak', maximumStacks: 1 }
  ];
  const phantomPain = balanceProfile(source, TRAIT.PHANTOM_PAIN);

  if (phantomPain)
    policies.push({ kind: 'phantom-pain', maximumStacks: balanceProfileNumber(phantomPain, 'maximumStacks') });

  return policies;
}
