import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';

/** Core owns shared weapon, pet, and trait effects; selected elites register their own policies. */
export function rangerBuffPolicies(_context: unknown): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'attack-of-opportunity-pet', maximumStacks: 1 },
    { kind: 'attack-of-opportunity-player', maximumStacks: 1 },
    { kind: 'sic-em', maximumStacks: 1 },
    { kind: 'sic-em-pet', maximumStacks: 1 },
    { kind: 'strength-of-the-pack', maximumStacks: 1 },
    { kind: 'paralyzing-venom', maximumStacks: 1 },
    { kind: 'light-on-your-feet', maximumStacks: 1 },
    { kind: 'lesser-sic-em-pet', maximumStacks: 1 },
    { kind: 'lesser-sic-em', maximumStacks: 1 }
  ];
  return policies;
}
