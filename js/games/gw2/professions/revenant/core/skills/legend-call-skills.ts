/** Owns Core legend-swap call skill fragments used by Song of the Mists. */
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';

/** Invocation and direct catalog consumers resolve the same patchable call skill. */
export const REVENANT_CORE_CALL_BY_LEGEND: Readonly<Record<string, SkillId>> = Object.freeze({
  [LEGEND.ASSASSIN]: ID.CALL_OF_THE_ASSASSIN,
  [LEGEND.DEMON]: ID.CALL_OF_THE_DEMON,
  [LEGEND.DWARF]: ID.CALL_OF_THE_DWARF,
  [LEGEND.CENTAUR]: ID.CALL_OF_THE_CENTAUR
});

export const REVENANT_LEGEND_CALL_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.CALL_OF_THE_DWARF]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Call of the Dwarf',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        name: 'Call of the Dwarf',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  [ID.CALL_OF_THE_CENTAUR]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.CALL_OF_THE_ASSASSIN]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.93,
        hits: 1,
        name: 'Call of the Assassin',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        name: 'Call of the Assassin',
        stacks: 8,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'quickness',
        name: 'Call of the Assassin',
        duration: 2,
        stacks: 1
      }
    ]
  },
  [ID.CALL_OF_THE_DEMON]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        name: 'Call of the Demon',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Slow',
        name: 'Call of the Demon - Slow',
        skillName: 'Call of the Demon',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        name: 'Call of the Demon - Torment',
        skillName: 'Call of the Demon',
        stacks: 2,
        duration: 8,
        actorType: 'player'
      }
    ]
  }
});
