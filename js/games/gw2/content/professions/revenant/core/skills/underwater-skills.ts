/** Owns Core Revenant underwater weapon skill fragments. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const REVENANT_UNDERWATER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.DOME_OF_THE_MISTS]: {
    castTimeMs: 0,
    cooldown: 20,
    energyCost: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.IGNITING_BRAND]: {
    castTimeMs: 500,
    cooldown: 12,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Igniting Brand',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.SPEAR_OF_ANGUISH]: {
    castTimeMs: 500,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Spear of Anguish',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.FRIGID_DISCHARGE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Frigid Discharge',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.DEVOUR_BRAND]: {
    castTimeMs: 500,
    cooldown: 0,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Devour Brand',
        actorType: 'player'
      }
    ]
  },
  [ID.VENOMOUS_SPHERE]: {
    castTimeMs: 750,
    cooldown: 8,
    energyCost: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        name: 'Venomous Sphere',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.RAPID_ASSAULT]: {
    castTimeMs: 1250,
    cooldown: 5,
    energyCost: 5,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 8 }, (_, index) => ({ atMs: 104.832 + index * 104.832, coefficient: 24 / 8 })),
        name: 'Rapid Assault',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.RIFT_CONTAINMENT]: {
    castTimeMs: 500,
    cooldown: 20,
    energyCost: 20,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: 72 + index * 72,
          coefficient: 6.6000000000000005 / 5
        })),
        name: 'Rift Containment',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  }
});
