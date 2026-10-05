import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';

/** Register Specter's effect rules only when its module is selected. */
export function specterBuffPolicies(): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [{ kind: 'barrier', maximumStacks: 1 }, { kind: 'rot-wallow-venom' }];
  return policies;
}
