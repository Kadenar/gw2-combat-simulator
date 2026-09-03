import type { BalanceProfile } from '#gw2/platform/engine/types.js';
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

export const FIREBRAND_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'guardian.firebrand.tome-pages',
  tomeJustice: 'guardian.firebrand.tome-justice',
  tomeResolve: 'guardian.firebrand.tome-resolve',
  tomeCourage: 'guardian.firebrand.tome-courage',
  ashes: 'guardian.firebrand.ashes-of-the-just',
  archivistOfWhispers: TRAIT.ARCHIVIST_OF_WHISPERS,
  loremaster: TRAIT.LOREMASTER,
  swiftScholar: TRAIT.SWIFT_SCHOLAR,
  legendaryLore: TRAIT.LEGENDARY_LORE,
  imbuedHaste: TRAIT.IMBUED_HASTE,
  liberatorsVow: TRAIT.LIBERATORS_VOW,
  weightyTerms: TRAIT.WEIGHTY_TERMS,
  stalwartSpeed: TRAIT.STALWART_SPEED,
  stoicDemeanor: TRAIT.STOIC_DEMEANOR,
  unrelentingCriticism: TRAIT.UNRELENTING_CRITICISM,
  quickfire: TRAIT.QUICKFIRE,
  passiveCourage: 'guardian.firebrand.passive-courage'
});

export const FIREBRAND_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: FIREBRAND_BALANCE_PROFILE_IDS.resources,
    name: 'Firebrand Tome Pages',
    profileKind: 'mechanic',
    maximumStacks: 5,
    pulseInterval: 8,
    effects: []
  },
  {
    id: FIREBRAND_BALANCE_PROFILE_IDS.tomeJustice,
    name: 'Tome of Justice - Dormant',
    profileKind: 'mechanic',
    cooldown: 20,
    effects: []
  },
  {
    id: FIREBRAND_BALANCE_PROFILE_IDS.tomeResolve,
    name: 'Tome of Resolve - Dormant',
    profileKind: 'mechanic',
    cooldown: 30,
    effects: []
  },
  {
    id: FIREBRAND_BALANCE_PROFILE_IDS.tomeCourage,
    name: 'Tome of Courage - Dormant',
    profileKind: 'mechanic',
    cooldown: 45,
    effects: []
  },
  {
    id: FIREBRAND_BALANCE_PROFILE_IDS.ashes,
    name: 'Ashes of the Just',
    profileKind: 'skill-variant',
    parentId: ID.ASHES_OF_THE_JUST,
    maximumStacks: 2,
    internalCooldown: 1,
    effects: [
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'buff',
        kind: 'ashes-of-the-just',
        stacks: 2,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        stacks: 8,
        duration: 10,
        actorType: 'player'
      }
    ]
  },
  trait(FIREBRAND_BALANCE_PROFILE_IDS.archivistOfWhispers, 'Archivist of Whispers', { maximumStacks: 8 }),
  trait(FIREBRAND_BALANCE_PROFILE_IDS.loremaster, 'Loremaster', {
    pulseInterval: 5
  }),
  trait(FIREBRAND_BALANCE_PROFILE_IDS.swiftScholar, 'Swift Scholar', {
    minimumStacks: 3,
    resourceGain: 1,
    effects: [{ type: 'boon', boon: 'quickness', stacks: 1, duration: 3 }]
  }),
  trait(FIREBRAND_BALANCE_PROFILE_IDS.legendaryLore, 'Legendary Lore', {
    effects: [
      { type: 'boon', boon: 'might', stacks: 2, duration: 10 },
      { type: 'boon', boon: 'regeneration', stacks: 1, duration: 6 },
      { type: 'boon', boon: 'protection', stacks: 1, duration: 4 }
    ]
  }),
  trait(FIREBRAND_BALANCE_PROFILE_IDS.imbuedHaste, 'Imbued Haste', {
    attributeBonus: 250
  }),
  trait(FIREBRAND_BALANCE_PROFILE_IDS.liberatorsVow, "Liberator's Vow", {
    internalCooldown: 7,
    effects: [{ type: 'boon', boon: 'quickness', stacks: 1, duration: 2 }]
  }),
  trait(FIREBRAND_BALANCE_PROFILE_IDS.weightyTerms, 'Weighty Terms', {
    resourceGain: 2,
    effects: [{ type: 'condition', condition: 'Slow', stacks: 1, duration: 1.5 }]
  }),
  trait(FIREBRAND_BALANCE_PROFILE_IDS.stalwartSpeed, 'Stalwart Speed', {
    internalCooldown: 7,
    effects: [{ type: 'boon', boon: 'quickness', stacks: 1, duration: 2 }]
  }),
  trait(FIREBRAND_BALANCE_PROFILE_IDS.stoicDemeanor, 'Stoic Demeanor', {
    effects: [
      { type: 'boon', boon: 'resistance', stacks: 1, duration: 2 },
      { type: 'boon', boon: 'might', stacks: 3, duration: 10 }
    ]
  }),
  trait(FIREBRAND_BALANCE_PROFILE_IDS.unrelentingCriticism, 'Unrelenting Criticism', {
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4.5
      }
    ]
  }),
  trait(FIREBRAND_BALANCE_PROFILE_IDS.quickfire, 'Quickfire', {
    internalCooldown: 7,
    effects: [
      {
        type: 'buff',
        kind: 'ashes-of-the-just',
        stacks: 1,
        duration: 10
      }
    ]
  }),
  {
    id: FIREBRAND_BALANCE_PROFILE_IDS.passiveCourage,
    name: 'Tome of Courage - Passive',
    profileKind: 'mechanic',
    pulseInterval: 40,
    effects: [{ type: 'boon', boon: 'aegis', stacks: 1, duration: 40 }]
  }
]);
