import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';

/** Register Chronomancer's effect rules only when its module is selected. */
export function chronomancerBuffPolicies(): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [{ kind: 'danger-time', maximumStacks: 1 }];
  return policies;
}
