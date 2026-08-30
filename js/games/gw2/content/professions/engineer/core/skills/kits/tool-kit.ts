/** Core Engineer Tool Kit skill mechanics. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Defines the equip action, palette skills, stow action, and linked toolbelt skill for Tool Kit. */
export const ENGINEER_TOOL_KIT_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  [ID.TOOL_KIT]: {
    implemented: true,
    handlerId: 'engineer.kit-equip',
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kitName: 'Tool Kit'
  },
  [ID.PRY_BAR]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Pry Bar',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 5,
        duration: 5,
        actorType: 'player'
      }
    ],
    kit: 'Tool Kit'
  },
  [ID.SMACK]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Smack',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ],
    kit: 'Tool Kit'
  },
  [ID.WHACK]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Whack',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ],
    kit: 'Tool Kit'
  },
  [ID.THWACK]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1,
        name: 'Thwack',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ],
    kit: 'Tool Kit'
  },
  [ID.BOX_OF_NAILS]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 10,
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ],
    kit: 'Tool Kit'
  },
  [ID.MAGNET]: {
    implemented: true,
    castTimeMs: 1250,
    cooldown: 15,
    effects: [],
    kit: 'Tool Kit'
  },
  [ID.GEAR_SHIELD]: {
    implemented: true,
    castTimeMs: 2000,
    cooldown: 15,
    effects: [],
    kit: 'Tool Kit'
  },
  [ID.THROW_WRENCH]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Throw Wrench',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Tool Kit'
  },
  [ID.STOW_TOOL_KIT]: {
    implemented: true,
    handlerId: 'engineer.kit-stow',
    paletteFlip: false,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kit: 'Tool Kit'
  }
});
