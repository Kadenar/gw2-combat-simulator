import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';

/** Register Druid's effect rules only when its module is selected. */
export function druidBuffPolicies(): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [{ kind: 'natural-balance', maximumStacks: 1 }];
  return policies;
}
