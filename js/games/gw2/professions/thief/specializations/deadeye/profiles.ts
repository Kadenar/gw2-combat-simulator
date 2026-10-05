import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { DEADEYE_THIEVES_GUILD_PROFILE } from '#gw2/professions/thief/specializations/deadeye/mechanics/thieves-guild.js';

import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

export const DEADEYE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'thief.deadeye.resources',
  maliciousSneakAttack: 'thief.deadeye.malicious-sneak-attack',
  maliciousAshenAssault: 'thief.deadeye.malicious-ashen-assault',
  mercy: 'thief.deadeye.mercy',
  shadowFlare: 'thief.deadeye.shadow-flare'
});

/** Canonical defaults also seed state-only previews; runtime initialization applies the selected patch. */
export const DEADEYE_RESOURCE_PROFILE: BalanceProfile = {
  id: DEADEYE_BALANCE_PROFILE_IDS.resources,
  name: 'Deadeye Malice and Mark',
  profileKind: 'mechanic',
  maximumStacks: 5,
  resourceGain: 1,
  playerStacks: 1,
  durationMultiplier: 30,
  effects: []
};

export const DEADEYE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  DEADEYE_THIEVES_GUILD_PROFILE,
  DEADEYE_RESOURCE_PROFILE,
  {
    id: DEADEYE_BALANCE_PROFILE_IDS.maliciousSneakAttack,
    name: 'Malicious Sneak Attack - Torment Scaling',
    profileKind: 'skill-variant',
    parentId: ID.MALICIOUS_SNEAK_ATTACK,
    durationMultiplier: 2,
    effects: [{ type: 'condition', name: 'Torment', condition: 'Torment', stacks: 1, duration: 1 }]
  },
  {
    id: DEADEYE_BALANCE_PROFILE_IDS.maliciousAshenAssault,
    name: 'Malicious Ashen Assault - Malice Scaling',
    profileKind: 'skill-variant',
    parentId: ID.MALICIOUS_ASHEN_ASSAULT,
    coefficientMultiplier: 0.02,
    durationMultiplier: 0.5,
    resourceGain: 4,
    effects: [{ type: 'condition', name: 'Torment', condition: 'Torment', stacks: 1, duration: 0.5 }]
  },
  {
    id: DEADEYE_BALANCE_PROFILE_IDS.mercy,
    name: 'Mercy Initiative Refund',
    profileKind: 'skill-variant',
    parentId: ID.MERCY,
    resourceGain: 3,
    attributePerStack: 1,
    effects: []
  },
  {
    id: DEADEYE_BALANCE_PROFILE_IDS.shadowFlare,
    name: 'Shadow Flare Flip Window',
    profileKind: 'skill-variant',
    parentId: ID.SHADOW_FLARE,
    durationMultiplier: 4,
    effects: []
  }
]);
