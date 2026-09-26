/** Explicit PvE skill mechanics owned by the Paragon Warrior module. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const PARAGON_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.WE_WILL_NEVER_YIELD]: {
    effects: [],
    castTimeMs: 667,
    categories: ['Command']
  },
  [ID.WE_SHALL_RETURN]: {
    cooldown: 20,
    effects: [],
    castTimeMs: 667,
    categories: ['Command']
  },
  [ID.CHANT_OF_RECUPERATION]: {
    effects: [],
    castTimeMs: 167,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    categories: ['Burst', 'Chant']
  },
  [ID.FIND_THEIR_WEAKNESS]: {
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 10
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 7
      }
    ],
    castTimeMs: 333,
    categories: ['Command']
  },
  [ID.ON_YOUR_KNEES]: {
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 6
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 6
      }
    ],
    castTimeMs: 167,
    categories: ['Command']
  },
  [ID.CHANT_OF_FREEDOM]: {
    effects: [],
    castTimeMs: 167,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    categories: ['Burst', 'Chant']
  },
  [ID.CHANT_OF_ACTION]: {
    effects: [],
    castTimeMs: 167,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    categories: ['Burst', 'Chant']
  }
});
