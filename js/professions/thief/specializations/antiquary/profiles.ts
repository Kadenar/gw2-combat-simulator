import type { BalanceProfile } from '../../../../platform/engine/types.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '../../data/ids.js';

export const ANTIQUARY_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'thief.antiquary.resources',
  scuffle: 'thief.antiquary.scuffle',
  artifactWindows: 'thief.antiquary.artifact-windows',
  forgedSurfer: 'thief.antiquary.forged-surfer',
  forgedSurferMeticulous: 'thief.antiquary.forged-surfer-meticulous',
  cannonSuccess: 'thief.antiquary.cannon-success',
  cannonBackfire: 'thief.antiquary.cannon-backfire',
  mistburnProc: 'thief.antiquary.mistburn-proc',
  sunCrystalMeticulous: 'thief.antiquary.sun-crystal-meticulous',
  repeatRansacker: TRAIT.REPEAT_RANSACKER,
  scoundrelsLuck: TRAIT.SCOUNDRELS_LUCK,
  combatHigh: TRAIT.COMBAT_HIGH,
  prolificPlunderer: TRAIT.PROLIFIC_PLUNDERER,
  prodigiousPincher: TRAIT.PRODIGIOUS_PINCHER,
  enterprisingAristocrat: TRAIT.ENTERPRISING_ARISTOCRAT,
  exhilaratingEphemera: TRAIT.EXHILARATING_EPHEMERA,
  possessiveHoarder: TRAIT.POSSESSIVE_HOARDER,
  meticulousCustodian: TRAIT.METICULOUS_CUSTODIAN
});

const trait = (id: number, name: string, fields: Readonly<Record<string, unknown>>): BalanceProfile => ({
  id,
  name,
  profileKind: 'trait',
  categories: ['Trait'],
  skillFamily: 'Trait',
  effects: [],
  ...fields
});

export const ANTIQUARY_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: ANTIQUARY_BALANCE_PROFILE_IDS.resources,
    name: 'Antiquary Artifact Resources',
    profileKind: 'mechanic',
    maximumStacks: 1,
    threshold: 15,
    effects: []
  },
  {
    id: ANTIQUARY_BALANCE_PROFILE_IDS.scuffle,
    name: 'Skritt Scuffle',
    profileKind: 'skill-variant',
    parentId: ID.SKRITT_SCUFFLE,
    durationMultiplier: 15,
    pulseInterval: 3,
    effects: []
  },
  {
    id: ANTIQUARY_BALANCE_PROFILE_IDS.artifactWindows,
    name: 'Antiquary Artifact Windows',
    profileKind: 'mechanic',
    durationMultiplier: 10,
    maximumStacks: 12,
    minimumStacks: 8,
    threshold: 10,
    playerStacks: 5,
    resourceGain: 3,
    rechargeMultiplier: 0.2,
    effects: []
  },
  {
    id: ANTIQUARY_BALANCE_PROFILE_IDS.forgedSurfer,
    name: 'Forged Surfer Dash',
    profileKind: 'skill-variant',
    parentId: ID.FORGED_SURFER_DASH_ID_76633,
    initialDelay: 1,
    pulseInterval: 3,
    maximumStacks: 5,
    effects: [
      { type: 'strike', coefficient: 2.4, hits: 1 },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 6 },
      { type: 'strike', coefficient: 1.2, hits: 1 },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 3.5 }
    ]
  },
  {
    id: ANTIQUARY_BALANCE_PROFILE_IDS.forgedSurferMeticulous,
    name: 'Forged Surfer Dash - Meticulous',
    profileKind: 'skill-variant',
    parentId: ID.FORGED_SURFER_DASH_ID_76633,
    effects: [
      { type: 'strike', coefficient: 2.8, hits: 1 },
      { type: 'condition', condition: 'Burning', stacks: 2, duration: 12 },
      { type: 'strike', coefficient: 1.4, hits: 1 },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 4.5 }
    ]
  },
  {
    id: ANTIQUARY_BALANCE_PROFILE_IDS.cannonSuccess,
    name: 'Stone Summit Cannon - Success',
    profileKind: 'skill-variant',
    parentId: ID.STONE_SUMMIT_CANNON,
    initialDelay: 0.44,
    pulseInterval: 0.283,
    effects: [
      { type: 'strike', coefficient: 1, hits: 3 },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 3 }
    ]
  },
  {
    id: ANTIQUARY_BALANCE_PROFILE_IDS.cannonBackfire,
    name: 'Stone Summit Cannon - Backfire',
    profileKind: 'skill-variant',
    parentId: ID.STONE_SUMMIT_CANNON,
    initialDelay: 2,
    effects: [
      { type: 'strike', coefficient: 3, hits: 1 },
      { type: 'condition', condition: 'Burning', stacks: 3, duration: 4 }
    ]
  },
  {
    id: ANTIQUARY_BALANCE_PROFILE_IDS.mistburnProc,
    name: 'Mistburn Mortar - Charged Strike',
    profileKind: 'skill-variant',
    parentId: ID.MISTBURN_MORTAR,
    effects: [{ type: 'condition', condition: 'Burning', stacks: 1, duration: 1 }]
  },
  {
    id: ANTIQUARY_BALANCE_PROFILE_IDS.sunCrystalMeticulous,
    name: 'Zephyrite Sun Crystal - Meticulous',
    profileKind: 'skill-variant',
    parentId: ID.ZEPHYRITE_SUN_CRYSTAL,
    effects: [{ type: 'condition', condition: 'Burning', stacks: 1, duration: 5 }]
  },
  trait(ANTIQUARY_BALANCE_PROFILE_IDS.repeatRansacker, 'Repeat Ransacker', {
    rechargeReduction: 2
  }),
  trait(ANTIQUARY_BALANCE_PROFILE_IDS.scoundrelsLuck, "Scoundrel's Luck", {
    maximumStacks: 1,
    internalCooldown: 20
  }),
  trait(ANTIQUARY_BALANCE_PROFILE_IDS.combatHigh, 'Combat High', {
    maximumStacks: 10,
    pulseInterval: 2,
    durationMultiplier: 20
  }),
  trait(ANTIQUARY_BALANCE_PROFILE_IDS.prolificPlunderer, 'Prolific Plunderer', { resourceGain: 1 }),
  trait(ANTIQUARY_BALANCE_PROFILE_IDS.prodigiousPincher, 'Prodigious Pincher', {
    threshold: 15
  }),
  trait(ANTIQUARY_BALANCE_PROFILE_IDS.enterprisingAristocrat, 'Enterprising Aristocrat', { resourceGain: 2 }),
  trait(ANTIQUARY_BALANCE_PROFILE_IDS.exhilaratingEphemera, 'Exhilarating Ephemera', {
    durationMultiplier: 10,
    maximumStacks: 20
  }),
  trait(ANTIQUARY_BALANCE_PROFILE_IDS.possessiveHoarder, 'Possessive Hoarder', {
    effects: [
      { type: 'boon', boon: 'might', stacks: 10, duration: 12 },
      { type: 'boon', boon: 'protection', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'alacrity', stacks: 1, duration: 5 }
    ]
  }),
  trait(ANTIQUARY_BALANCE_PROFILE_IDS.meticulousCustodian, 'Meticulous Custodian', {
    effects: [{ type: 'strike', coefficient: 0.3, hits: 1 }]
  })
]);
