import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

export const SOULBEAST_BALANCE_PROFILE_IDS = Object.freeze({
  oneWolfPack: 'ranger.soulbeast.one-wolf-pack',
  vultureStance: 'ranger.soulbeast.vulture-stance',
  wintersBite: 'ranger.soulbeast.winters-bite',
  unstoppableUnion: TRAIT.UNSTOPPABLE_UNION,
  leaderOfThePack: TRAIT.LEADER_OF_THE_PACK,
  liveFast: TRAIT.LIVE_FAST,
  wiltingStrike: TRAIT.WILTING_STRIKE,
  goForTheEyes: TRAIT.GO_FOR_THE_EYES,
  twiceAsVicious: TRAIT.TWICE_AS_VICIOUS,
  bestialRage: TRAIT.BESTIAL_RAGE,
  predatorsCunning: TRAIT.PREDATORS_CUNNING,
  essenceOfSpeed: TRAIT.ESSENCE_OF_SPEED,
  stoutArchetype: 'ranger.soulbeast.archetype.stout',
  deadlyArchetype: 'ranger.soulbeast.archetype.deadly',
  versatileArchetype: 'ranger.soulbeast.archetype.versatile',
  ferociousArchetype: 'ranger.soulbeast.archetype.ferocious',
  supportiveArchetype: 'ranger.soulbeast.archetype.supportive'
});

const archetype = (id: string, name: string, fields: Readonly<Record<string, number>>): BalanceProfile => ({
  id,
  name: `Soulbeast ${name} Archetype`,
  profileKind: 'mechanic',
  effects: [],
  ...fields
});

export const SOULBEAST_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: SOULBEAST_BALANCE_PROFILE_IDS.oneWolfPack,
    parentId: ID.ONE_WOLF_PACK,
    name: 'One Wolf Pack - Echo',
    profileKind: 'skill-variant',
    durationMultiplier: 6,
    internalCooldown: 1,
    initialDelay: 0.28,
    effects: [{ type: 'strike', coefficient: 0.95, hits: 1 }]
  },
  {
    id: SOULBEAST_BALANCE_PROFILE_IDS.vultureStance,
    parentId: ID.VULTURE_STANCE,
    name: 'Vulture Stance - Triggered Effects',
    profileKind: 'skill-variant',
    durationMultiplier: 6,
    internalCooldown: 0.25,
    effects: [
      { type: 'condition', condition: 'Poisoned', duration: 4, stacks: 1 },
      { type: 'boon', boon: 'might', duration: 4, stacks: 1 }
    ]
  },
  {
    id: SOULBEAST_BALANCE_PROFILE_IDS.wintersBite,
    parentId: ID.WINTERS_BITE,
    name: "Winter's Bite - Beastmode Trigger",
    profileKind: 'skill-variant',
    effects: [{ type: 'condition', condition: 'Weakness', duration: 10, stacks: 1 }]
  },
  trait(SOULBEAST_BALANCE_PROFILE_IDS.unstoppableUnion, 'Unstoppable Union', {
    effects: [{ type: 'boon', boon: 'protection', duration: 2.5, stacks: 1 }]
  }),
  trait(SOULBEAST_BALANCE_PROFILE_IDS.leaderOfThePack, 'Leader of the Pack', {
    durationMultiplier: 1.2
  }),
  trait(SOULBEAST_BALANCE_PROFILE_IDS.liveFast, 'Live Fast', {
    effects: [
      { type: 'boon', boon: 'fury', duration: 6, stacks: 1 },
      { type: 'boon', boon: 'quickness', duration: 3, stacks: 1 }
    ]
  }),
  trait(SOULBEAST_BALANCE_PROFILE_IDS.wiltingStrike, 'Wilting Strike', {
    effects: [{ type: 'condition', condition: 'Weakness', duration: 4, stacks: 1 }]
  }),
  trait(SOULBEAST_BALANCE_PROFILE_IDS.goForTheEyes, 'Go for the Eyes', {
    internalCooldown: 12,
    effects: [{ type: 'blind', duration: 5 }]
  }),
  trait(SOULBEAST_BALANCE_PROFILE_IDS.twiceAsVicious, 'Twice as Vicious', {
    effects: [
      {
        type: 'buff',
        kind: 'twice-as-vicious',
        duration: 10,
        stacks: 1
      }
    ]
  }),
  trait(SOULBEAST_BALANCE_PROFILE_IDS.bestialRage, 'Bestial Rage', {
    internalCooldown: 0.25,
    effects: [
      { type: 'boon', boon: 'might', duration: 8, stacks: 5 },
      { type: 'boon', boon: 'fury', duration: 3, stacks: 1 }
    ]
  }),
  trait(SOULBEAST_BALANCE_PROFILE_IDS.predatorsCunning, "Predator's Cunning", {
    effects: [{ type: 'strike', coefficient: 0.006, hits: 1 }]
  }),
  trait(SOULBEAST_BALANCE_PROFILE_IDS.essenceOfSpeed, 'Essence of Speed', {
    internalCooldown: 5,
    durationMultiplier: 2
  }),
  archetype(SOULBEAST_BALANCE_PROFILE_IDS.stoutArchetype, 'Stout', {
    attributeBonus: 200,
    weaponAttributeBonus: 100
  }),
  archetype(SOULBEAST_BALANCE_PROFILE_IDS.deadlyArchetype, 'Deadly', {
    attributeBonus: 150,
    weaponAttributeBonus: 100
  }),
  archetype(SOULBEAST_BALANCE_PROFILE_IDS.versatileArchetype, 'Versatile', {
    attributeBonus: 200,
    weaponAttributeBonus: 225
  }),
  archetype(SOULBEAST_BALANCE_PROFILE_IDS.ferociousArchetype, 'Ferocious', {
    attributeBonus: 150,
    weaponAttributeBonus: 100
  }),
  archetype(SOULBEAST_BALANCE_PROFILE_IDS.supportiveArchetype, 'Supportive', {
    attributeBonus: 100
  })
]);
