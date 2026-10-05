import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';

/** Register Virtuoso's effect rules only when its module is selected. */
export function virtuosoBuffPolicies(): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [{ kind: 'deadly-blades', maximumStacks: 1 }];
  return policies;
}
