import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';

/** Register Troubadour's effect rules only when its module is selected. */
export function troubadourBuffPolicies(): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [{ kind: 'altered-chord', maximumStacks: 1 }];
  return policies;
}
