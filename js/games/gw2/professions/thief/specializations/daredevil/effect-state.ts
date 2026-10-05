import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';

/** Register Daredevil's effect rules only when its module is selected. */
export function daredevilBuffPolicies(): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'bounding-dodger', maximumStacks: 1 },
    { kind: 'lotus-training', maximumStacks: 1 },
    { kind: 'weakening-strikes', maximumStacks: 1 }
  ];
  return policies;
}
