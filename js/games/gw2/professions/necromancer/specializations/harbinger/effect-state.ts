import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';

/** Register Harbinger's effect rules only when its module is selected. */
export function harbingerBuffPolicies(): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'meltdown', maximumStacks: 1 },
    { kind: 'implacable-foe', maximumStacks: 1 },
    { kind: 'harbinger-shroud', maximumStacks: 1 },
    { kind: 'harbinger-blight' }
  ];
  return policies;
}
