/** Explicit PvE skill mechanics owned by the Paragon Warrior module. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const PARAGON_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.WE_WILL_NEVER_YIELD]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 667,
    categories: ['Command'],
    handlerId: 'warrior.command'
  },
  [ID.WE_SHALL_RETURN]: {
    implemented: true,
    cooldown: 20,
    effects: [],
    quicknessCastTimeMs: 667,
    categories: ['Command'],
    handlerId: 'warrior.command'
  },
  [ID.CHANT_OF_RECUPERATION]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 167,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    categories: ['Burst', 'Chant'],
    handlerId: 'warrior.chant'
  },
  [ID.FIND_THEIR_WEAKNESS]: {
    implemented: true,
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
    quicknessCastTimeMs: 333,
    categories: ['Command'],
    handlerId: 'warrior.command'
  },
  [ID.ON_YOUR_KNEES]: {
    implemented: true,
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
    quicknessCastTimeMs: 167,
    categories: ['Command'],
    handlerId: 'warrior.command'
  },
  [ID.CHANT_OF_FREEDOM]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 167,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    categories: ['Burst', 'Chant'],
    handlerId: 'warrior.chant'
  },
  [ID.CHANT_OF_ACTION]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 167,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    categories: ['Burst', 'Chant'],
    handlerId: 'warrior.chant'
  }
});
