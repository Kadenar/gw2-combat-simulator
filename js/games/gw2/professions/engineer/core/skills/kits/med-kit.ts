/** Core Engineer Med Kit skill mechanics. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/** Defines the equip action, palette skills, stow action, and linked toolbelt skill for Med Kit. */
export const ENGINEER_MED_KIT_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  [ID.MED_KIT]: {
    // Custom: Equips the kit and updates bundle/weapon state; see `core/mechanics/kits.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    handlerId: 'engineer.kit-equip',
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kitName: 'Med Kit'
  },
  [ID.STOW_MED_KIT]: {
    // Custom: Stows the active kit and restores weapon state; see `core/mechanics/kits.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    handlerId: 'engineer.kit-stow',
    paletteFlip: false,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kit: 'Med Kit'
  },
  [ID.BANDAGE_BLAST]: {
    castTimeMs: 360,
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
    castTimeMs: 680,
    cooldown: 17,
    effects: [],
    toolbeltParentName: 'Med Kit',
    mechanicSlot: 1
  },
  [ID.MED_BLASTER]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 840,
    cooldown: 0,
    effects: [],
    kit: 'Med Kit'
  },
  [ID.CLEANSING_FIELD]: {
    castTimeMs: 400,
    cooldown: 15,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: 'Water',
        duration: 3,
        startAnchor: 'castEnd'
      }
    ],
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
    castTimeMs: 680,
    cooldown: 20,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ],
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
