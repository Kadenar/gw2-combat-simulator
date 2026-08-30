/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const THIEF_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.VENOMOUS_VOLLEY]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 3.5999999999999996,
        hits: 3,
        name: 'Venomous Volley',
        actorType: 'player',
        atMs: 173.333333333333,
        intervalMs: 173.333333333333,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.SPINNING_AXE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Spinning Axe',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.HARROWING_STORM]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Axe',
    requiredOffHand: 'Dagger'
  },
  [ID.RECALL_AXES]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Axe',
    requiredOffHand: false
  },
  [ID.ORCHESTRATED_ASSAULT]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Axe',
    requiredOffHand: 'Pistol'
  },
  [ID.SPINNING_AXE_ID_71967]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Spinning Axe',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.CUNNING_SALVO]: {
    implemented: true,
    handlerId: 'thief.stealth-attack',
    castTimeMs: 500,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Cunning Salvo',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Axe',
    stealthAttack: true
  }
});
