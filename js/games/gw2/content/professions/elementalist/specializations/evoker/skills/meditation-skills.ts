/**
 * Owns Evoker meditation heal, utility, and elite skill fragments.
 * Meditation trait reactions are registered by the Evoker module.
 */
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Declares the meditation catalog while the shared handler applies Altruistic Aspect. */
export const EVOKER_MEDITATION_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FOXS_FURY]: {
    name: "Fox's Fury",
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Evoker',
    categories: ['Meditation'],
    quicknessCastTimeMs: 600,
    cooldown: 18,
    skillFamily: 'Meditation',
    // Custom: Applies Altruistic Aspect after the meditation effects; see `evoker/module.ts`.
    handlerId: 'elementalist.evoker-meditation',
    effects: []
  },
  [ID.HARES_AGILITY]: {
    name: "Hare's Agility",
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Evoker',
    categories: ['Meditation'],
    quicknessCastTimeMs: 0,
    cooldown: 20,
    resourceGain: 50,
    skillFamily: 'Meditation',
    // Custom: Applies Altruistic Aspect after the meditation effects; see `evoker/module.ts`.
    handlerId: 'elementalist.evoker-meditation',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 0.4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'Swiftness',
        stacks: 1,
        duration: 10,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.TOADS_FORTITUDE]: {
    name: "Toad's Fortitude",
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Evoker',
    categories: ['Meditation'],
    quicknessCastTimeMs: 640,
    cooldown: 15,
    skillFamily: 'Meditation',
    // Custom: Applies Altruistic Aspect after the meditation effects; see `evoker/module.ts`.
    handlerId: 'elementalist.evoker-meditation',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 640,
            coefficient: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 640,
            condition: 'Bleeding',
            stacks: 4,
            duration: 10
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.ELEMENTAL_PROCESSION]: {
    name: 'Elemental Procession',
    type: 'Elite',
    slot: 'Elite',
    specialization: 'Evoker',
    categories: ['Meditation'],
    quicknessCastTimeMs: 600,
    cooldown: 60,
    skillFamily: 'Meditation',
    // Custom: Applies Altruistic Aspect after the meditation effects; see `evoker/module.ts`.
    handlerId: 'elementalist.evoker-meditation',
    effects: []
  },
  [ID.REJUVENATE]: {
    name: 'Rejuvenate',
    type: 'Heal',
    slot: 'Heal',
    specialization: 'Evoker',
    categories: ['Meditation'],
    quicknessCastTimeMs: 600,
    cooldown: 18,
    skillFamily: 'Meditation',
    effects: []
  }
});
