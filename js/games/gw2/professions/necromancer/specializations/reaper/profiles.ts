import type { BalanceProfile } from '#gw2/platform/engine/types.js';
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

export const REAPER_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'necromancer.reaper.resources',
  deathlyChill: TRAIT.DEATHLY_CHILL,
  chillingNova: TRAIT.CHILLING_NOVA,
  shiversOfDread: TRAIT.SHIVERS_OF_DREAD,
  auguryOfDeath: TRAIT.AUGURY_OF_DEATH,
  chillingVictory: TRAIT.CHILLING_VICTORY,
  blightersBoon: TRAIT.BLIGHTERS_BOON,
  reapersOnslaught: TRAIT.REAPERS_ONSLAUGHT
});

export const REAPER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: REAPER_BALANCE_PROFILE_IDS.resources,
    name: 'Reaper Shroud',
    profileKind: 'mechanic',
    lifeForceDrain: 4,
    effects: []
  },
  trait(REAPER_BALANCE_PROFILE_IDS.deathlyChill, 'Deathly Chill', {
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 4,
        actorType: 'effect'
      }
    ]
  }),
  trait(REAPER_BALANCE_PROFILE_IDS.chillingNova, 'Chilling Nova', {
    cooldown: 3,
    criticalChance: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 1.125,
        hits: 1,
        actorType: 'effect'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2,
        actorType: 'effect'
      }
    ]
  }),
  trait(REAPER_BALANCE_PROFILE_IDS.shiversOfDread, 'Shivers of Dread', {
    effects: [
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2,
        actorType: 'effect'
      }
    ]
  }),
  trait(REAPER_BALANCE_PROFILE_IDS.auguryOfDeath, 'Augury of Death', {
    effects: [
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 276,
        flatStrikePowerCoeff: 0.02,
        actorType: 'effect',
        noCrit: true,
        damageKind: 'life-steal'
      }
    ]
  }),
  trait(REAPER_BALANCE_PROFILE_IDS.chillingVictory, 'Chilling Victory', {
    cooldown: 1,
    lifeForceGain: 1
  }),
  trait(REAPER_BALANCE_PROFILE_IDS.blightersBoon, "Blighter's Boon", {
    lifeForceGain: 1
  }),
  trait(REAPER_BALANCE_PROFILE_IDS.reapersOnslaught, "Reaper's Onslaught", {
    attributeBonus: 300,
    rechargeReduction: 1,
    quicknessCastMultiplier: 1.5
  })
]);
