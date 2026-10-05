import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';

/** Register Weaver's effect rules only when its module is selected. */
export function weaverBuffPolicies(): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'perfect weave', maximumStacks: 1 },
    { kind: 'weave self air', maximumStacks: 1 },
    { kind: 'weave self fire', maximumStacks: 1 },
    { kind: 'weave self water', maximumStacks: 1 },
    { kind: 'weave self earth', maximumStacks: 1 },
    { kind: 'elements of rage', maximumStacks: 1 }
  ];
  return policies;
}
