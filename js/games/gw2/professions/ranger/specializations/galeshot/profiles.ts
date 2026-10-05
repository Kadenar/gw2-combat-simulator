import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const GALESHOT_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'ranger.galeshot.resources',
  mistral: 'ranger.galeshot.mistral'
});

export const GALESHOT_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: GALESHOT_BALANCE_PROFILE_IDS.resources,
    name: 'Cyclone Bow Arrows and Wind Force',
    profileKind: 'mechanic',
    maximumStacks: 8,
    minimumStacks: 5,
    pulseInterval: 5,
    effects: []
  },
  {
    id: GALESHOT_BALANCE_PROFILE_IDS.mistral,
    parentId: ID.MISTRAL,
    name: 'Mistral - Missile Trigger',
    profileKind: 'skill-variant',
    durationMultiplier: 6,
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 0.3, hits: 1 },
      { name: 'Chilled', type: 'condition', condition: 'Chilled', duration: 1, stacks: 1 }
    ]
  }
]);
