import type { BalanceProfile, SkillEffect } from '#gw2/platform/engine/skills/types.js';
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';

/**
 * Stable profile ids for every patchable Tempest value; trait entries reuse the shared trait ids so
 * balance patches address them by the same key the trait catalog uses.
 */
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

// Shorthand for the boon effect shape repeated across the trait profiles below.
const boon = (name: string, boonName: string, stacks: number, duration: number): SkillEffect => ({
  type: 'boon',
  name,
  boon: boonName,
  stacks,
  duration
});

/**
 * Balance-authorable Tempest data: the overload singularity dwell timings, the Overload Air
 * follow-up strike, and the boon/attribute payloads each Tempest trait hands to its runtime hook.
 * Field names follow the generic profile schema, so several traits reuse `durationMultiplier` and
 * `maximumStacks` for values that are simply durations or caps in seconds.
 */
export const TEMPEST_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: TEMPEST_BALANCE_PROFILE_IDS.overloads,
    name: 'Tempest Overload Singularity',
    profileKind: 'mechanic',
    // Seconds an attunement must be held before its overload unlocks: `initialDelay` normally,
    // `durationMultiplier` once Transcendent Tempest shortens the wait.
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
    // One entry per attunement: the completing overload looks its aura duration up by
    // attunement name, so the effect `name` is the lookup key rather than the aura's name.
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
    // Each aura extends the damage buff by `durationMultiplier` seconds, capped `maximumStacks`
    // seconds past the triggering aura; `Shout Might` is the separate shout-completion payload.
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
    // Seconds the post-overload damage buff lasts.
    durationMultiplier: 7
  }),
  trait(TEMPEST_BALANCE_PROFILE_IDS.lucidSingularity, 'Lucid Singularity', {
    // At most `maximumStacks` overload hits pulse alacrity; the last of them uses `Final Alacrity`.
    maximumStacks: 5,
    effects: [boon('Pulse Alacrity', 'alacrity', 1, 1), boon('Final Alacrity', 'alacrity', 1, 4.5)]
  }),
  trait(TEMPEST_BALANCE_PROFILE_IDS.elementalBastion, 'Elemental Bastion', {
    effects: [boon('Alacrity', 'alacrity', 1, 4)]
  })
]);
