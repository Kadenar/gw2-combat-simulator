/** Core Engineer Med Kit skill mechanics. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Defines the equip action, palette skills, stow action, and linked toolbelt skill for Med Kit. */
export const ENGINEER_MED_KIT_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  [ID.MED_KIT]: {
    // Custom: Equips the kit and updates bundle/weapon state; see `core/mechanics/kits.ts`.
    handlerId: 'engineer.kit-equip',
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kitName: 'Med Kit'
  },
  [ID.STOW_MED_KIT]: {
    // Custom: Stows the active kit and restores weapon state; see `core/mechanics/kits.ts`.
    handlerId: 'engineer.kit-stow',
    paletteFlip: false,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kit: 'Med Kit'
  },
  [ID.BANDAGE_BLAST]: {
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
    castTimeMs: 1000,
    cooldown: 17,
    effects: [],
    toolbeltParentName: 'Med Kit',
    mechanicSlot: 1
  },
  [ID.MED_BLASTER]: {
    castTimeMs: 1250,
    cooldown: 0,
    effects: [],
    kit: 'Med Kit'
  },
  [ID.CLEANSING_FIELD]: {
    castTimeMs: 500,
    cooldown: 15,
    effects: [],
    kit: 'Med Kit'
  },
  [ID.VITAL_BURST]: {
    castTimeMs: 0,
    cooldown: 20,
    effects: [],
    kit: 'Med Kit'
  },
  [ID.INFUSION_BOMB]: {
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
