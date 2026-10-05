import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';
import { balanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

/** Register Tempest's effect rules only when its module is selected. */
export function tempestBuffPolicies(context: unknown): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [{ kind: 'transcendent-tempest', maximumStacks: 1 }];
  const tempestuousAria = balanceProfileFromContext(context, TRAIT.TEMPESTUOUS_ARIA);
  if (tempestuousAria)
    policies.push({
      kind: 'tempestuous aria',
      maximumStacks: 1,
      maximumDuration: balanceProfileNumber(tempestuousAria, 'maximumStacks')
    });
  return policies;
}
