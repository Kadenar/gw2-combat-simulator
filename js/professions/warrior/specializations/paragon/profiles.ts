import type { BalanceProfile } from '../../../../platform/engine/types.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '../../data/ids.js';

export const PARAGON_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'warrior.paragon.motivation',
  chants: 'warrior.paragon.chants',
  commands: 'warrior.paragon.command-echoes',
  strengtheningStanzas: TRAIT.STRENGTHENING_STANZAS,
  briskPacing: TRAIT.BRISK_PACING,
  inspiringImplements: TRAIT.INSPIRING_IMPLEMENTS,
  enduringRefrain: TRAIT.ENDURING_REFRAIN,
  feverishPulse: TRAIT.FEVERISH_PULSE,
  callToAction: TRAIT.CALL_TO_ACTION,
  rallyTheValiant: TRAIT.RALLY_THE_VALIANT,
  reverberation: TRAIT.REVERBERATION
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

export const PARAGON_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: PARAGON_BALANCE_PROFILE_IDS.resources,
    name: 'Paragon Motivation',
    profileKind: 'mechanic',
    maximumStacks: 10,
    minimumStacks: 4,
    threshold: 7,
    pulseInterval: 3,
    effects: []
  },
  {
    id: PARAGON_BALANCE_PROFILE_IDS.chants,
    name: 'Paragon Chant Entry',
    profileKind: 'mechanic',
    resourceGain: 4,
    effects: [
      { type: 'boon', boon: 'might', stacks: 5, duration: 8 },
      { type: 'boon', boon: 'fury', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'vigor', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'stability', stacks: 1, duration: 3 }
    ]
  },
  {
    id: PARAGON_BALANCE_PROFILE_IDS.commands,
    name: 'Paragon Command Echoes',
    profileKind: 'mechanic',
    pulseInterval: 3,
    maximumStacks: 2,
    effects: []
  },
  trait(PARAGON_BALANCE_PROFILE_IDS.strengtheningStanzas, 'Strengthening Stanzas', {
    damageMultiplier: 0.15,
    coefficientMultiplier: 0.1
  }),
  trait(PARAGON_BALANCE_PROFILE_IDS.briskPacing, 'Brisk Pacing', {
    minimumStacks: 4,
    threshold: 7,
    damageMultiplier: 0.1,
    damageIncreasePerStack: 0.1,
    coefficientMultiplier: 0.05
  }),
  trait(PARAGON_BALANCE_PROFILE_IDS.inspiringImplements, 'Inspiring Implements', {
    attributeBonus: 180,
    internalCooldown: 4,
    resourceGain: 5,
    minimumStacks: 2
  }),
  trait(PARAGON_BALANCE_PROFILE_IDS.enduringRefrain, 'Enduring Refrain', {
    resourceGain: 1
  }),
  trait(PARAGON_BALANCE_PROFILE_IDS.feverishPulse, 'Feverish Pulse', {
    rechargeReduction: 2,
    effects: [{ type: 'boon', boon: 'alacrity', stacks: 1, duration: 6 }]
  }),
  trait(PARAGON_BALANCE_PROFILE_IDS.callToAction, 'Call to Action', {
    resourceGain: 4
  }),
  trait(PARAGON_BALANCE_PROFILE_IDS.rallyTheValiant, 'Rally the Valiant', {
    resourceGain: 4
  }),
  trait(PARAGON_BALANCE_PROFILE_IDS.reverberation, 'Reverberation', {
    maximumStacks: 2
  })
]);
