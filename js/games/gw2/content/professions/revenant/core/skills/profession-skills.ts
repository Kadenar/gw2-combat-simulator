/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const REVENANT_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.LEGENDARY_DWARF_STANCE_ID_26650]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_ASSASSIN_STANCE_ID_27659]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_ASSASSIN_STANCE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_CENTAUR_STANCE_ID_28141]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_CENTAUR_STANCE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_DEMON_STANCE_ID_28376]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_DWARF_STANCE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_DEMON_STANCE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.ANCIENT_ECHO]: {
    implemented: true,
    // Custom: Restores energy using the active legend's amount; see `core/skills/actions.ts`.
    handlerId: 'revenant.ancient-echo',
    castTimeMs: 500,
    cooldown: 20,
    energyCost: 0,
    resourceGain: 25,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'Resistance',
        duration: 3,
        stacks: 1
      }
    ]
  }
});
