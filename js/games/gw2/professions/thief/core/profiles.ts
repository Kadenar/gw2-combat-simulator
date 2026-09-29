import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';

import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

export const THIEF_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'thief.core.resources',
  unloadRefund: 'thief.core.unload-refund',
  ashenAssaultRefund: 'thief.core.ashen-assault-refund',
  spiderVenomProc: 'thief.core.spider-venom-proc',
  skaleVenomProc: 'thief.core.skale-venom-proc',
  devourerVenomProc: 'thief.core.devourer-venom-proc',
  fallingSpiderEmpowered: 'thief.core.falling-spider-empowered',
  distractingThrow: 'thief.core.distracting-throw',
  assassinsSignet: 'thief.core.assassins-signet',
  signetOfAgility: 'thief.core.signet-of-agility'
});

/** Canonical defaults also seed state-only previews; runtime initialization applies the selected patch. */
export const THIEF_CORE_RESOURCE_PROFILE: BalanceProfile = {
  id: THIEF_CORE_BALANCE_PROFILE_IDS.resources,
  name: 'Thief Core Resources',
  profileKind: 'mechanic',
  maximumStacks: 12,
  minimumStacks: 15,
  resourceGain: 1,
  kneelingInitiativeRegenerationBonus: 1 / 3,
  resourceCost: 50,
  enduranceRegenerationPerSecond: 5,
  vigorRegenerationMultiplier: 1.5,
  threshold: 10,
  effects: []
};

export const THIEF_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  // Both activation and passive stats follow the selected balance profile.
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.signetOfAgility,
    name: 'Signet of Agility',
    profileKind: 'mechanic',
    attributeBonus: 180,
    resourceGain: 100,
    effects: []
  },
  THIEF_CORE_RESOURCE_PROFILE,
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.unloadRefund,
    name: 'Unload Initiative Refund',
    profileKind: 'skill-variant',
    parentId: ID.UNLOAD,
    resourceGain: 2,
    effects: []
  },
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.ashenAssaultRefund,
    name: 'Ashen Assault Initiative Refund',
    profileKind: 'skill-variant',
    parentId: ID.ASHEN_ASSAULT,
    resourceGain: 4,
    effects: []
  },
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.spiderVenomProc,
    name: 'Spider Venom - Triggered Poison',
    profileKind: 'skill-variant',
    parentId: ID.SPIDER_VENOM,
    maximumStacks: 6,
    durationMultiplier: 24,
    effects: [{ type: 'condition', name: 'Poisoned', condition: 'Poisoned', stacks: 1, duration: 3 }]
  },
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.skaleVenomProc,
    name: 'Skale Venom - Triggered Conditions',
    profileKind: 'skill-variant',
    parentId: ID.SKALE_VENOM,
    maximumStacks: 4,
    durationMultiplier: 24,
    effects: [
      { type: 'condition', name: 'Vulnerability', condition: 'Vulnerability', stacks: 1, duration: 10 },
      { type: 'condition', name: 'Torment', condition: 'Torment', stacks: 1, duration: 3 }
    ]
  },
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.devourerVenomProc,
    name: 'Devourer Venom - Triggered Immobilize',
    profileKind: 'skill-variant',
    parentId: ID.DEVOURER_VENOM,
    maximumStacks: 2,
    durationMultiplier: 24,
    effects: [{ type: 'condition', name: 'Immobilized', condition: 'Immobilized', stacks: 1, duration: 1 }]
  },
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.fallingSpiderEmpowered,
    name: 'Falling Spider - Empowered',
    profileKind: 'skill-variant',
    parentId: ID.FALLING_SPIDER,
    damageMultiplier: 1.15,
    resourceGain: 1,
    effects: []
  },
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.distractingThrow,
    name: 'Distracting Throw - Finisher Bonus',
    profileKind: 'skill-variant',
    parentId: ID.DISTRACTING_THROW,
    durationMultiplier: 10,
    effects: []
  },
  {
    id: THIEF_CORE_BALANCE_PROFILE_IDS.assassinsSignet,
    name: "Assassin's Signet",
    profileKind: 'skill-variant',
    parentId: ID.ASSASSINS_SIGNET,
    attributeBonus: 180,
    attributePerStack: 540,
    durationMultiplier: 5,
    effects: []
  }
  // Trait tuning is shared by build calculations, combat, and tooltips.
]);
