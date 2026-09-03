/** Owns Legendary Centaur Stance skill fragments and their alternate identities. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const REVENANT_CENTAUR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.PROTECTIVE_SOLACE]: {
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep',
    castTimeMs: 0,
    cooldown: 5,
    energyCost: 5,
    upkeepCost: 8,
    pulseInterval: 1,
    effects: [],
    legendId: 'LegendaryCentaur'
  },
  [ID.NATURAL_HARMONY]: {
    castTimeMs: 0,
    cooldown: 2,
    energyCost: 20,
    effects: [],
    legendId: 'LegendaryCentaur'
  },
  [ID.ENERGY_EXPULSION]: {
    castTimeMs: 0,
    cooldown: 2,
    energyCost: 35,
    effects: [
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'knockdown',
        duration: 3
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 5,
        stacks: 3
      }
    ],
    legendId: 'LegendaryCentaur'
  },
  [ID.DIMINISH_SOLACE]: {
    castTimeMs: 0,
    cooldown: 5,
    energyCost: 0,
    effects: []
  },
  [ID.PURIFYING_ESSENCE]: {
    castTimeMs: 0,
    cooldown: 5,
    energyCost: 25,
    effects: [],
    legendId: 'LegendaryCentaur'
  },
  [ID.VENTARIS_WILL]: {
    castTimeMs: 0,
    cooldown: 0.25,
    energyCost: 0,
    effects: [],
    legendId: 'LegendaryCentaur'
  },
  [ID.PROJECT_TRANQUILITY]: {
    castTimeMs: 0,
    cooldown: 2,
    energyCost: 0,
    effects: [],
    legendId: 'LegendaryCentaur'
  },
  [ID.PROTECTIVE_SOLACE_ID_29310]: {
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep',
    castTimeMs: 0,
    cooldown: 5,
    energyCost: 5,
    upkeepCost: 8,
    pulseInterval: 1,
    effects: [],
    legendId: 'LegendaryCentaur'
  }
});
