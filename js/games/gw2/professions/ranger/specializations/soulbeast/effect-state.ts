import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';

/** Register Soulbeast's effect rules only when its module is selected. */
export function soulbeastBuffPolicies(): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'one-wolf-pack', maximumStacks: 1 },
    { kind: 'vulture-stance', maximumStacks: 1 },
    { kind: 'twice-as-vicious', maximumStacks: 1 }
  ];
  return policies;
}
