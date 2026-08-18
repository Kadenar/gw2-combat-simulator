import type { BalanceProfile, SkillEffect, SkillId } from '../../../../platform/engine/types.js';
import { ELEMENTALIST_SKILL_IDS as ID, ELEMENTALIST_TRAIT_IDS as TRAIT } from '../../data/ids.js';

export const TEMPEST_BALANCE_PROFILE_IDS = Object.freeze({
  overloads: 'elementalist.tempest.overloads',
  lightningJolt: 'elementalist.tempest.lightning-jolt',
  galeSong: TRAIT.GALE_SONG,
  latentStamina: TRAIT.LATENT_STAMINA,
  unstableConduit: TRAIT.UNSTABLE_CONDUIT,
  gatheredFocus: TRAIT.GATHERED_FOCUS,
  hardyConduit: TRAIT.HARDY_CONDUIT,
  tempestuousAria: TRAIT.TEMPESTUOUS_ARIA,
  harmoniousConduit: TRAIT.HARMONIOUS_CONDUIT,
  invigoratingTorrents: TRAIT.INVIGORATING_TORRENTS,
  transcendentTempest: TRAIT.TRANSCENDENT_TEMPEST,
  lucidSingularity: TRAIT.LUCID_SINGULARITY,
  elementalBastion: TRAIT.ELEMENTAL_BASTION
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

export const TEMPEST_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: TEMPEST_BALANCE_PROFILE_IDS.overloads,
    name: 'Tempest Overload Singularity',
    profileKind: 'mechanic',
    initialDelay: 6,
    durationMultiplier: 4,
    effects: []
  },
  {
    id: TEMPEST_BALANCE_PROFILE_IDS.lightningJolt,
    parentId: ID.OVERLOAD_AIR,
    name: 'Overload Air - Lightning Jolt',
    profileKind: 'skill-variant',
    // Each affected ally receives one non-critical, unequipped-weapon strike for its next attack.
    effects: [{ type: 'strike', coefficient: 1.32, hits: 1 }]
  },
  trait(TEMPEST_BALANCE_PROFILE_IDS.galeSong, 'Gale Song', {
    effects: [boon('Protection', 'protection', 1, 3)]
  }),
  trait(TEMPEST_BALANCE_PROFILE_IDS.latentStamina, 'Latent Stamina', {
    internalCooldown: 10,
    effects: [boon('Vigor', 'vigor', 1, 3)]
  }),
  trait(TEMPEST_BALANCE_PROFILE_IDS.unstableConduit, 'Unstable Conduit', {
    effects: [
      {
        type: 'buff',
        name: 'Fire',
        kind: 'Fire Aura',
        stacks: 1,
        duration: 4
      },
      {
        type: 'buff',
        name: 'Water',
        kind: 'Frost Aura',
        stacks: 1,
        duration: 4
      },
      {
        type: 'buff',
        name: 'Air',
        kind: 'Shocking Aura',
        stacks: 1,
        duration: 4
      },
      {
        type: 'buff',
        name: 'Earth',
        kind: 'Magnetic Aura',
        stacks: 1,
        duration: 4
      }
    ]
  }),
  trait(TEMPEST_BALANCE_PROFILE_IDS.gatheredFocus, 'Gathered Focus', {
    attributeBonus: 240
  }),
  trait(TEMPEST_BALANCE_PROFILE_IDS.hardyConduit, 'Hardy Conduit', {
    effects: [boon('Protection', 'protection', 1, 3)]
  }),
  trait(TEMPEST_BALANCE_PROFILE_IDS.tempestuousAria, 'Tempestuous Aria', {
    maximumStacks: 10,
    durationMultiplier: 5,
    effects: [boon('Shout Might', 'might', 2, 10)]
  }),
  trait(TEMPEST_BALANCE_PROFILE_IDS.harmoniousConduit, 'Harmonious Conduit', {
    effects: [boon('Swiftness', 'swiftness', 1, 8), boon('Stability', 'stability', 1, 4)]
  }),
  trait(TEMPEST_BALANCE_PROFILE_IDS.invigoratingTorrents, 'Invigorating Torrents', {
    effects: [boon('Vigor', 'vigor', 1, 5), boon('Regeneration', 'regeneration', 1, 5)]
  }),
  trait(TEMPEST_BALANCE_PROFILE_IDS.transcendentTempest, 'Transcendent Tempest', {
    durationMultiplier: 7
  }),
  trait(TEMPEST_BALANCE_PROFILE_IDS.lucidSingularity, 'Lucid Singularity', {
    maximumStacks: 5,
    effects: [boon('Pulse Alacrity', 'alacrity', 1, 1), boon('Final Alacrity', 'alacrity', 1, 4.5)]
  }),
  trait(TEMPEST_BALANCE_PROFILE_IDS.elementalBastion, 'Elemental Bastion', {
    effects: [boon('Alacrity', 'alacrity', 1, 4)]
  })
]);
