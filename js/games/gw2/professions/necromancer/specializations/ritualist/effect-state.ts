import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';

/** Register Ritualist's effect rules only when its module is selected. */
export function ritualistBuffPolicies(): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [{ kind: 'necromancer-painful-bond', maximumStacks: 1 }];
  policies.push(
    ...['nightmare', 'splinter', 'resilient'].map((spell) => ({
      kind: spell + '-weapon',
      owner: 'profession' as const
    }))
  );
  return policies;
}
