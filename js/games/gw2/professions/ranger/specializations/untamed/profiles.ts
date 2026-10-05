import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const UNTAMED_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'ranger.untamed.resources',
  explodingSporesRanger: 'ranger.untamed.exploding-spores.ranger',
  explodingSporesPet: 'ranger.untamed.exploding-spores.pet'
});

export const UNTAMED_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: UNTAMED_BALANCE_PROFILE_IDS.resources,
    name: 'Unleash and Ambush Windows',
    profileKind: 'mechanic',
    durationMultiplier: 4,
    internalCooldown: 9,
    recharge: 1,
    effects: []
  },
  {
    id: UNTAMED_BALANCE_PROFILE_IDS.explodingSporesRanger,
    parentId: ID.EXPLODING_SPORES,
    name: 'Exploding Spores - Ranger Unleashed',
    profileKind: 'skill-variant',
    effects: [{ name: 'might', type: 'boon', boon: 'might', duration: 10, stacks: 8 }]
  },
  {
    id: UNTAMED_BALANCE_PROFILE_IDS.explodingSporesPet,
    parentId: ID.EXPLODING_SPORES,
    name: 'Exploding Spores - Pet Unleashed',
    profileKind: 'skill-variant',
    effects: [{ name: 'protection', type: 'boon', boon: 'protection', duration: 4, stacks: 1 }]
  }
]);
