/** Owns Core legend-swap call skill definitions used by Song of the Mists. */
import { ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition, SkillId } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Invocation and direct catalog consumers resolve the same patchable call skill. */
export const REVENANT_CORE_CALL_BY_LEGEND: Readonly<Record<string, SkillId>> = Object.freeze({
  [LEGEND.ASSASSIN]: ID.CALL_OF_THE_ASSASSIN,
  [LEGEND.DEMON]: ID.CALL_OF_THE_DEMON,
  [LEGEND.DWARF]: ID.CALL_OF_THE_DWARF
});

export const REVENANT_LEGEND_CALL_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RevenantSkill>>> = {
  [ID.CALL_OF_THE_DWARF]: {
    name: 'Call of the Dwarf',
    icon: 'https://render.guildwars2.com/file/03C66FA8A89697A0C4D309484172080E3A1141EF/961410.png',
    type: 'Action',
    slot: 'Action',
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Call of the Dwarf',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        name: 'Call of the Dwarf',
        stacks: 1,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.CALL_OF_THE_ASSASSIN]: {
    name: 'Call of the Assassin',
    icon: 'https://render.guildwars2.com/file/67CDD35F6BC3072E0837715A5E0A90646529BAA2/1030005.png',
    type: 'Action',
    slot: 'Action',
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.93,
        hits: 1,
        name: 'Call of the Assassin',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        name: 'Call of the Assassin',
        stacks: 8,
        duration: 5,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        boon: BOON.QUICKNESS,
        name: 'Call of the Assassin',
        duration: 2,
        stacks: 1
      }
    ]
  },
  [ID.CALL_OF_THE_DEMON]: {
    name: 'Call of the Demon',
    icon: 'https://render.guildwars2.com/file/1A1407F7D34E5ED41B59A25F39EBF728CC926423/961413.png',
    type: 'Action',
    slot: 'Action',
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        name: 'Call of the Demon',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.SLOW,
        name: 'Call of the Demon - Slow',
        skillName: 'Call of the Demon',
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        name: 'Call of the Demon - Torment',
        skillName: 'Call of the Demon',
        stacks: 2,
        duration: 8,
        actorType: ACTOR.PLAYER
      }
    ]
  }
};
