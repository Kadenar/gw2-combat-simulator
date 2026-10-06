/** Mechanic and skill-variant tuning for Evoker; traits own their primary and additional profiles under traits/. */
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/balance-profiles.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

/** Stable mechanic and skill-variant patch identities. */
export const EVOKER_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'elementalist.evoker.resources',
  foxsFury: 'elementalist.evoker.foxs-fury',
  familiarUtility: 'elementalist.evoker.familiar-utility',
  ignite: 'elementalist.evoker.ignite',
  splash: 'elementalist.evoker.splash',
  zap: 'elementalist.evoker.zap',
  calcify: 'elementalist.evoker.calcify'
});

// terse constructor for the many named boon effects declared below
const boon = (name: string, boonName: string, stacks: number, duration: number): SkillEffect => ({
  type: 'boon',
  name,
  boon: boonName,
  stacks,
  duration
});

/** Charge economy and tiered familiar skills retain their mechanic and skill profiles. */
export const EVOKER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: EVOKER_BALANCE_PROFILE_IDS.resources,
    name: 'Evoker Familiar Charges',
    profileKind: 'mechanic',
    maximumStacks: 6,
    minimumStacks: 3,
    playerStacks: 2,
    allyStacks: 1,
    recharge: 1.5,
    effects: []
  },
  {
    id: EVOKER_BALANCE_PROFILE_IDS.foxsFury,
    parentId: ID.FOXS_FURY,
    name: "Fox's Fury - Might Tiers",
    profileKind: 'skill-variant',
    initialDelay: 0.56,
    threshold: 10,
    // API tier values multiply Fox's Fury's 1.5 baseline: https://api.guildwars2.com/v2/skills/77282?lang=en
    effects: [
      { type: 'strike', name: 'Tier 1', coefficient: 1.5, hits: 1 },
      {
        type: 'condition',
        name: 'Tier 1',
        condition: 'Burning',
        stacks: 1,
        duration: 3
      },
      { type: 'strike', name: 'Tier 2', coefficient: 2.25, hits: 1 },
      {
        type: 'condition',
        name: 'Tier 2',
        condition: 'Burning',
        stacks: 2,
        duration: 5
      },
      { type: 'strike', name: 'Tier 3', coefficient: 3, hits: 1 },
      {
        type: 'condition',
        name: 'Tier 3',
        condition: 'Burning',
        stacks: 3,
        // PvE's high-Might burn lasts five seconds before condition-duration bonuses.
        duration: 5
      }
    ]
  },
  {
    id: EVOKER_BALANCE_PROFILE_IDS.familiarUtility,
    parentId: ID.HARES_AGILITY,
    name: 'Evoker Familiar Utility Effects',
    profileKind: 'skill-variant',
    playerStacks: 5,
    resourceGain: 1,
    effects: [
      boon('Fox Might', 'might', 8, 10),
      boon('Fox Fire Bonus', 'might', 3, 10),
      boon('Fox Fury', 'fury', 1, 10),
      boon('Toad Resistance', 'resistance', 1, 4),
      {
        type: 'buff',
        name: 'Zap Window',
        // The emitter, policy, and damage modifier share this single buff identity.
        kind: 'zap buff',
        stacks: 1,
        duration: 5
      },
      // Skill grants have distinct lifetimes, independent of Galvanic Enchantment's trait window.
      { type: 'buff', name: 'Hare Enchantment', duration: 10 },
      { type: 'buff', name: 'Lightning Blitz Enchantment', duration: 6 }
    ]
  },
  variant(EVOKER_BALANCE_PROFILE_IDS.ignite, ID.IGNITE, 'Ignite - Familiar State', {
    initialDelay: 0.96,
    durationMultiplier: 2.4,
    threshold: 15,
    pulseInterval: 1,
    effects: [
      {
        type: 'condition',
        name: 'Tier 1',
        condition: 'Burning',
        stacks: 1,
        duration: 2
      },
      {
        type: 'condition',
        name: 'Tier 2',
        condition: 'Burning',
        stacks: 1,
        duration: 0.5
      },
      {
        type: 'condition',
        name: 'Tier 3',
        condition: 'Burning',
        stacks: 1,
        duration: 1
      },
      {
        type: 'condition',
        name: 'Tier 4',
        condition: 'Burning',
        stacks: 1,
        duration: 1.5
      }
    ]
  }),
  variant(EVOKER_BALANCE_PROFILE_IDS.splash, ID.SPLASH, 'Splash - Familiar State', {
    initialDelay: 0.84,
    durationMultiplier: 2.4
  }),
  variant(EVOKER_BALANCE_PROFILE_IDS.zap, ID.ZAP, 'Zap - Familiar State', {
    initialDelay: 0.68,
    durationMultiplier: 2.3
  }),
  variant(EVOKER_BALANCE_PROFILE_IDS.calcify, ID.CALCIFY, 'Calcify - Familiar State', {
    initialDelay: 0.28,
    durationMultiplier: 2.2,
    // The equipped Earth familiar grants personal Protection on disables, independently of party pulses.
    internalCooldown: 0.25,
    effects: [{ ...boon('Protection', 'protection', 1, 2), audience: { recipients: 'self' } }]
  })
]);
