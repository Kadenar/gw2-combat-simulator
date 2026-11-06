import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';
import type { BalanceProfileSource } from '#gw2/platform/skills/balance-profiles.js';
import { balanceProfile, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

/** Register Evoker's effect rules only when its module is selected. */
export function evokerBuffPolicies(source: BalanceProfileSource): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'zap buff', maximumStacks: 1 },
    { kind: 'hare enchantment', maximumStacks: 1 },
    { kind: 'lightning blitz enchantment', maximumStacks: 1 }
  ];
  const familiarsProwess = balanceProfile(source, TRAIT.FAMILIARS_PROWESS);

  if (familiarsProwess)
    policies.push({
      kind: 'familiars-prowess',
      maximumStacks: 1,
      maximumDuration: balanceProfileNumber(familiarsProwess, 'maximumStacks')
    });

  return policies;
}
