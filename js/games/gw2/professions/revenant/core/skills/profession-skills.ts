/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const REVENANT_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.LEGENDARY_DWARF_STANCE_ID_26650]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_ASSASSIN_STANCE_ID_27659]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_ASSASSIN_STANCE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_CENTAUR_STANCE_ID_28141]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_CENTAUR_STANCE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_DEMON_STANCE_ID_28376]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_DWARF_STANCE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_DEMON_STANCE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.ANCIENT_ECHO]: {
    // The replacing handler selects only the currently channeled legend's package and restores Energy.
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
        stacks: 1,
        metadata: { legendId: LEGEND.CENTAUR }
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 3,
        stacks: 1,
        metadata: { legendId: LEGEND.DEMON }
      },
      {
        type: 'buff',
        kind: 'unblockable',
        duration: 5,
        stacks: 2,
        metadata: { legendId: LEGEND.ASSASSIN }
      },
      {
        type: 'buff',
        kind: 'rite-of-the-great-dwarf',
        duration: 3,
        stacks: 1,
        metadata: { legendId: LEGEND.DWARF }
      }
    ]
  }
});
