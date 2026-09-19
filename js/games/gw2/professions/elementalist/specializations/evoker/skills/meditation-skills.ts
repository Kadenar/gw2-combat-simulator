/**
 * Owns Evoker meditation heal, utility, and elite skill fragments.
 * Meditation trait reactions are registered by the Evoker module.
 */
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/** Declares the meditation catalog while the shared handler applies Altruistic Aspect. */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const EVOKER_MEDITATION_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FOXS_FURY]: {
    name: "Fox's Fury",
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Evoker',
    categories: ['Meditation'],
    castTimeMs: 600,
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
    castTimeMs: 0,
    cooldown: 20,
    resourceGain: 50,
    skillFamily: 'Meditation',
    // Custom: Applies Altruistic Aspect after the meditation effects; see `evoker/module.ts`.
    handlerId: 'elementalist.evoker-meditation',
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.4 },
      { type: 'boon', boon: 'Swiftness', stacks: 1, duration: 10, metadata: {} }
    ])
  },
  [ID.TOADS_FORTITUDE]: {
    name: "Toad's Fortitude",
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Evoker',
    categories: ['Meditation'],
    castTimeMs: 640,
    cooldown: 15,
    skillFamily: 'Meditation',
    // Custom: Applies Altruistic Aspect after the meditation effects; see `evoker/module.ts`.
    handlerId: 'elementalist.evoker-meditation',
    effects: impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.5 },
      { type: 'condition', condition: 'Bleeding', stacks: 4, duration: 10, metadata: {} }
    ])
  },
  [ID.ELEMENTAL_PROCESSION]: {
    name: 'Elemental Procession',
    type: 'Elite',
    slot: 'Elite',
    specialization: 'Evoker',
    categories: ['Meditation'],
    castTimeMs: 600,
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
    castTimeMs: 600,
    cooldown: 18,
    skillFamily: 'Meditation',
    effects: []
  }
});
