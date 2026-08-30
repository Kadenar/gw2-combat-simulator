import type { BalanceProfile } from '#gw2/platform/engine/types.js';
import { defineTraitProfile as trait } from '#gw2/integrations/patches/authoring/balance-profiles.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/content/professions/thief/data/ids.js';

export const DEADEYE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'thief.deadeye.resources',
  maliciousSneakAttack: 'thief.deadeye.malicious-sneak-attack',
  maliciousAshenAssault: 'thief.deadeye.malicious-ashen-assault',
  mercy: 'thief.deadeye.mercy',
  shadowFlare: 'thief.deadeye.shadow-flare',
  maliciousIntent: TRAIT.MALICIOUS_INTENT,
  maleficentSeven: TRAIT.MALEFICENT_SEVEN,
  beQuickOrBeKilled: TRAIT.BE_QUICK_OR_BE_KILLED,
  fireForEffect: TRAIT.FIRE_FOR_EFFECT,
  silentScope: TRAIT.SILENT_SCOPE,
  premeditation: TRAIT.PREMEDITATION
});

export const DEADEYE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: DEADEYE_BALANCE_PROFILE_IDS.resources,
    name: 'Deadeye Malice and Mark',
    profileKind: 'mechanic',
    maximumStacks: 5,
    minimumStacks: 7,
    resourceGain: 1,
    playerStacks: 1,
    durationMultiplier: 30,
    effects: []
  },
  {
    id: DEADEYE_BALANCE_PROFILE_IDS.maliciousSneakAttack,
    name: 'Malicious Sneak Attack - Torment Scaling',
    profileKind: 'skill-variant',
    parentId: ID.MALICIOUS_SNEAK_ATTACK,
    durationMultiplier: 2,
    effects: [{ type: 'condition', condition: 'Torment', stacks: 1, duration: 1 }]
  },
  {
    id: DEADEYE_BALANCE_PROFILE_IDS.maliciousAshenAssault,
    name: 'Malicious Ashen Assault - Malice Scaling',
    profileKind: 'skill-variant',
    parentId: ID.MALICIOUS_ASHEN_ASSAULT,
    coefficientMultiplier: 0.02,
    durationMultiplier: 0.5,
    resourceGain: 4,
    effects: [{ type: 'condition', condition: 'Torment', stacks: 1, duration: 0.5 }]
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
  },
  trait(DEADEYE_BALANCE_PROFILE_IDS.maliciousIntent, 'Malicious Intent', {
    resourceGain: 2
  }),
  trait(DEADEYE_BALANCE_PROFILE_IDS.maleficentSeven, 'Maleficent Seven', {
    maximumStacks: 7,
    resourceGain: 7,
    effects: [
      { type: 'boon', boon: 'Might', stacks: 10, duration: 10 },
      { type: 'boon', boon: 'Fury', stacks: 1, duration: 10 },
      { type: 'boon', boon: 'Protection', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'Regeneration', stacks: 1, duration: 10 },
      { type: 'boon', boon: 'Swiftness', stacks: 1, duration: 10 },
      { type: 'boon', boon: 'Vigor', stacks: 1, duration: 10 }
    ]
  }),
  trait(DEADEYE_BALANCE_PROFILE_IDS.beQuickOrBeKilled, 'Be Quick or Be Killed', {
    attributeBonus: 200,
    effects: [{ type: 'boon', boon: 'Quickness', stacks: 1, duration: 4 }]
  }),
  trait(DEADEYE_BALANCE_PROFILE_IDS.fireForEffect, 'Fire for Effect', {
    effects: [
      { type: 'boon', boon: 'Might', stacks: 8, duration: 12 },
      { type: 'boon', boon: 'Fury', stacks: 1, duration: 12 }
    ]
  }),
  trait(DEADEYE_BALANCE_PROFILE_IDS.silentScope, 'Silent Scope', {
    threshold: 3,
    durationMultiplier: 3,
    attributeBonus: 120
  }),
  trait(DEADEYE_BALANCE_PROFILE_IDS.premeditation, 'Premeditation', {
    attributeBonus: 180
  })
]);
