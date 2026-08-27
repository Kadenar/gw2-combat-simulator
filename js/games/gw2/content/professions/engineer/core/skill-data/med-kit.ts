/** Core Engineer Med Kit skill mechanics. */
import { ENGINEER_SKILL_IDS as ID } from '../../data/ids.js';
import type { SkillFragment } from '../../../../../platform/engine/types.js';

// Owns the equip action, palette skills, stow action, and linked toolbelt skill for Med Kit.
export const ENGINEER_MED_KIT_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  [ID.MED_KIT]: {
    implemented: true,
    handlerId: 'engineer.kit-equip',
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kitName: 'Med Kit'
  },
  [ID.STOW_MED_KIT]: {
    implemented: true,
    handlerId: 'engineer.kit-stow',
    paletteFlip: false,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kit: 'Med Kit'
  },
  [ID.BANDAGE_BLAST]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 8,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 1
      }
    ],
    kit: 'Med Kit'
  },
  [ID.BANDAGE_SELF]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 17,
    effects: [],
    toolbeltParentName: 'Med Kit',
    mechanicSlot: 1
  },
  [ID.MED_BLASTER]: {
    implemented: true,
    castTimeMs: 1250,
    cooldown: 0,
    effects: [],
    kit: 'Med Kit'
  },
  [ID.CLEANSING_FIELD]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 15,
    effects: [],
    kit: 'Med Kit'
  },
  [ID.VITAL_BURST]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 20,
    effects: [],
    kit: 'Med Kit'
  },
  [ID.INFUSION_BOMB]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 10,
        stacks: 1
      }
    ],
    kit: 'Med Kit'
  }
});
