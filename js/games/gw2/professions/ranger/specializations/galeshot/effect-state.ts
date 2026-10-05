import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';

/** Register Galeshot's effect rules only when its module is selected. */
export function galeshotBuffPolicies(): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [{ kind: 'gale-force', maximumStacks: 1 }];
  return policies;
}
