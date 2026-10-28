/** Core Engineer Med Kit skill mechanics. */
import { BOON, COMBO_FIELD, COMBO_FINISHER, RECIPIENT } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

/** Defines the equip action, palette skills, stow action, and linked toolbelt skill for Med Kit. */
export const ENGINEER_MED_KIT_SKILL_MECHANICS: Readonly<Record<string, Partial<Skill>>> = Object.freeze({
  [ID.MED_KIT]: {
    // Custom: Equips the kit and updates bundle/weapon state; see `core/hooks.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'equip',
    cooldown: 0,
    castTimeMs: 0,
    effects: [],
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }]
  },
  [ID.STOW_MED_KIT]: {
    // Custom: Stows the active kit and restores weapon state; see `core/hooks.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'stow',
    paletteFlip: false,
    cooldown: 0,
    kitId: ID.MED_KIT,
    castTimeMs: 0,
    effects: [],
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }]
  },
  [ID.MED_BLASTER]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    kitId: ID.MED_KIT,
    castTimeMs: 840,
    effects: []
  },
  [ID.BANDAGE_SELF]: {
    cooldown: 17,
    toolbeltParentId: ID.MED_KIT,
    mechanicSlot: 1,
    castTimeMs: 680,
    effects: []
  },
  [ID.BANDAGE_BLAST]: {
    cooldown: 8,
    kitId: ID.MED_KIT,
    castTimeMs: 360,
    effects: [
      {
        type: 'boon',
        boon: BOON.REGENERATION,
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.CLEANSING_FIELD]: {
    cooldown: 15,
    kitId: ID.MED_KIT,
    castTimeMs: 400,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: COMBO_FIELD.WATER,
        duration: 3,
        startAnchor: 'castEnd'
      }
    ],
    effects: []
  },
  [ID.VITAL_BURST]: {
    cooldown: 20,
    kitId: ID.MED_KIT,
    castTimeMs: 0,
    effects: []
  },
  [ID.INFUSION_BOMB]: {
    cooldown: 20,
    kitId: ID.MED_KIT,
    castTimeMs: 680,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.BLAST
      }
    ],
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.SWIFTNESS,
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.VIGOR,
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 10,
        stacks: 1
      }
    ]
  }
});
