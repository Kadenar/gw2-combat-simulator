import type { BalanceProfile, SkillEffect, SkillId } from '../../../../platform/engine/types.js';
import { ELEMENTALIST_SKILL_IDS as ID, ELEMENTALIST_TRAIT_IDS as TRAIT } from '../../data/ids.js';

export const WEAVER_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'elementalist.weaver.resources',
  primordialStance: 'elementalist.weaver.primordial-stance',
  unravel: 'elementalist.weaver.unravel',
  ferventStance: 'elementalist.weaver.fervent-stance',
  frostfireFlurry: 'elementalist.weaver.frostfire-flurry-bullets',
  purblindingPlasma: 'elementalist.weaver.purblinding-plasma-bullet',
  moltenMeteor: 'elementalist.weaver.molten-meteor-bullet',
  flowingFinesse: 'elementalist.weaver.flowing-finesse-bullets',
  enervatingEarth: 'elementalist.weaver.enervating-earth-bullet',
  elementalRefreshment: TRAIT.ELEMENTAL_REFRESHMENT,
  elementalPolyphony: TRAIT.ELEMENTAL_POLYPHONY,
  superiorElements: TRAIT.SUPERIOR_ELEMENTS,
  elementalPursuit: TRAIT.ELEMENTAL_PURSUIT,
  weaversProwess: TRAIT.WEAVERS_PROWESS,
  swiftRevenge: TRAIT.SWIFT_REVENGE,
  bolsteredElements: TRAIT.BOLSTERED_ELEMENTS,
  elementsOfRage: TRAIT.ELEMENTS_OF_RAGE,
  flowState: TRAIT.FLOW_STATE
});

const trait = (id: SkillId, name: string, fields: Readonly<Record<string, unknown>> = {}): BalanceProfile => ({
  id,
  name,
  profileKind: 'trait',
  categories: ['Trait'],
  skillFamily: 'Trait',
  effects: [],
  ...fields
});

const boon = (name: string, boonName: string, stacks: number, duration: number): SkillEffect => ({
  type: 'boon',
  name,
  boon: boonName,
  stacks,
  duration
});

const variant = (
  id: string,
  parentId: SkillId,
  name: string,
  fields: Readonly<Record<string, unknown>> = {}
): BalanceProfile => ({
  id,
  parentId,
  name,
  profileKind: 'skill-variant',
  effects: [],
  ...fields
});

const condition = (name: string, conditionName: string, stacks: number, duration: number): SkillEffect => ({
  type: 'condition',
  name,
  condition: conditionName,
  stacks,
  duration
});

const aura = (name: string, auraName: string, duration: number): SkillEffect => ({
  type: 'buff',
  name,
  kind: auraName,
  stacks: 1,
  duration
});

export const WEAVER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: WEAVER_BALANCE_PROFILE_IDS.resources,
    name: 'Weaver Attunement Resources',
    profileKind: 'mechanic',
    initialDelay: 2,
    recharge: 10,
    durationMultiplier: 20,
    maximumStacks: 4,
    firstPacketRatio: 0.65,
    effects: []
  },
  variant(WEAVER_BALANCE_PROFILE_IDS.frostfireFlurry, ID.FROSTFIRE_FLURRY, 'Frostfire Flurry - Consumed Bullets', {
    effects: [aura('Fire', 'Fire Aura', 3), condition('Water', 'Vulnerability', 4, 8)]
  }),
  variant(WEAVER_BALANCE_PROFILE_IDS.purblindingPlasma, ID.PURBLINDING_PLASMA, 'Purblinding Plasma - Fire Bullet', {
    rechargeMultiplier: 2 / 3,
    effects: [condition('Fire', 'Burning', 3, 4)]
  }),
  variant(WEAVER_BALANCE_PROFILE_IDS.moltenMeteor, ID.MOLTEN_METEOR, 'Molten Meteor - Earth Bullet', {
    effects: [condition('Earth', 'Bleeding', 3, 8)]
  }),
  variant(WEAVER_BALANCE_PROFILE_IDS.flowingFinesse, ID.FLOWING_FINESSE, 'Flowing Finesse - Consumed Bullets', {
    effects: [aura('Water', 'Frost Aura', 3), boon('Air', 'Superspeed', 1, 4)]
  }),
  variant(WEAVER_BALANCE_PROFILE_IDS.enervatingEarth, ID.ENERVATING_EARTH, 'Enervating Earth - Earth Bullet', {
    effects: [condition('Earth', 'Bleeding', 4, 8)]
  }),
  {
    id: WEAVER_BALANCE_PROFILE_IDS.primordialStance,
    parentId: ID.PRIMORDIAL_STANCE_FIRE,
    name: 'Primordial Stance - Dynamic Pulse',
    profileKind: 'skill-variant',
    effects: [
      { type: 'strike', coefficient: 0.33, hits: 1 },
      {
        type: 'condition',
        name: 'Fire',
        condition: 'Burning',
        stacks: 1,
        duration: 2
      },
      {
        type: 'condition',
        name: 'Water',
        condition: 'Chilled',
        stacks: 1,
        duration: 1
      },
      {
        type: 'condition',
        name: 'Air',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 3
      },
      {
        type: 'condition',
        name: 'Earth',
        condition: 'Bleeding',
        stacks: 2,
        duration: 6
      }
    ]
  },
  {
    id: WEAVER_BALANCE_PROFILE_IDS.unravel,
    parentId: ID.UNRAVEL,
    name: 'Unravel - Attunement and Boons',
    profileKind: 'skill-variant',
    durationMultiplier: 5,
    effects: [
      boon('Fire', 'might', 5, 5),
      boon('Water', 'vigor', 1, 5),
      boon('Air', 'fury', 1, 5),
      boon('Earth', 'protection', 1, 5)
    ]
  },
  {
    id: WEAVER_BALANCE_PROFILE_IDS.ferventStance,
    parentId: ID.FERVENT_STANCE,
    name: 'Fervent Stance - Dual Attack Might',
    profileKind: 'skill-variant',
    durationMultiplier: 8,
    effects: [boon('Might', 'might', 3, 8)]
  },
  trait(WEAVER_BALANCE_PROFILE_IDS.elementalRefreshment, 'Elemental Refreshment', { attributeBonus: 180 }),
  trait(WEAVER_BALANCE_PROFILE_IDS.elementalPolyphony, 'Elemental Polyphony', {
    attributeBonus: 200
  }),
  trait(WEAVER_BALANCE_PROFILE_IDS.superiorElements, 'Superior Elements', {
    internalCooldown: 4,
    effects: [
      {
        type: 'condition',
        name: 'Weakness',
        condition: 'Weakness',
        stacks: 1,
        duration: 5
      }
    ]
  }),
  trait(WEAVER_BALANCE_PROFILE_IDS.elementalPursuit, 'Elemental Pursuit', {
    effects: [boon('Swiftness', 'swiftness', 1, 3)]
  }),
  trait(WEAVER_BALANCE_PROFILE_IDS.weaversProwess, "Weaver's Prowess", {
    effects: [boon('Resistance', 'resistance', 1, 3)]
  }),
  trait(WEAVER_BALANCE_PROFILE_IDS.swiftRevenge, 'Swift Revenge', {
    resourceGain: 25,
    effects: [boon('Fire', 'might', 3, 5), boon('Air', 'swiftness', 1, 5)]
  }),
  trait(WEAVER_BALANCE_PROFILE_IDS.bolsteredElements, 'Bolstered Elements', {
    effects: [boon('Protection', 'protection', 1, 3)]
  }),
  trait(WEAVER_BALANCE_PROFILE_IDS.elementsOfRage, 'Elements of Rage', {
    durationMultiplier: 8
  }),
  trait(WEAVER_BALANCE_PROFILE_IDS.flowState, 'Flow State', {
    rechargeReduction: 1, // flat seconds removed from attunement recharge
    rechargeMultiplier: 0.8 // fraction of dual-skill recharge retained
  })
]);
