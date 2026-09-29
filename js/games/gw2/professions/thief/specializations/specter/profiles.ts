import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';

import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

export const SPECTER_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'thief.specter.resources',
  enterShadowShroud: 'thief.specter.enter-shadow-shroud',
  dawnsReposeBarrier: 'thief.specter.dawns-repose-barrier'
});

export const SPECTER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: SPECTER_BALANCE_PROFILE_IDS.resources,
    name: 'Specter Shadow Force',
    profileKind: 'mechanic',
    maximumStacks: 100,
    resourceGain: 1,
    lifeForceGain: 25,
    lifeForceDrain: 0.02,
    effects: []
  },
  {
    id: SPECTER_BALANCE_PROFILE_IDS.enterShadowShroud,
    name: 'Enter Shadow Shroud - Barrier',
    profileKind: 'skill-variant',
    parentId: ID.ENTER_SHADOW_SHROUD,
    maximumTargets: 1,
    effects: [{ type: 'buff', name: 'barrier', kind: 'barrier', stacks: 1, duration: 5 }]
  },
  {
    id: SPECTER_BALANCE_PROFILE_IDS.dawnsReposeBarrier,
    name: "Dawn's Repose - Barrier",
    profileKind: 'skill-variant',
    parentId: ID.DAWNS_REPOSE,
    // The caster occupies one of the five barrier recipient slots.
    maximumTargets: 5,
    effects: [{ type: 'buff', name: 'barrier', kind: 'barrier', stacks: 1, duration: 5 }]
  }
]);
