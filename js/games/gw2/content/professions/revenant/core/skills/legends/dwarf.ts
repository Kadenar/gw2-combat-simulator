/** Owns Legendary Dwarf Stance skill fragments and their alternate identities. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const REVENANT_DWARF_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.VENGEFUL_HAMMERS]: {
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep',
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 5,
    upkeepCost: 6,
    pulseInterval: 1 / 3,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 3,
        atMs: 0,
        name: 'Vengeful Hammers',
        actorType: 'effect'
      }
    ],
    legendId: 'LegendaryDwarf'
  },
  [ID.FORCED_ENGAGEMENT]: {
    castTimeMs: 500,
    cooldown: 15,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Forced Engagement',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'taunt',
        duration: 4
      }
    ],
    legendId: 'LegendaryDwarf'
  },
  [ID.RELEASE_HAMMERS]: {
    // Custom: Releases the active upkeep skill and exposes its parent again; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep-release',
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [],
    legendId: 'LegendaryDwarf'
  },
  [ID.SOOTHING_STONE]: {
    castTimeMs: 1000,
    cooldown: 30,
    energyCost: 5,
    effects: [
      {
        type: 'boon',
        boon: 'resolution',
        duration: 5,
        stacks: 1
      }
    ],
    legendId: 'LegendaryDwarf'
  },
  [ID.RITE_OF_THE_GREAT_DWARF]: {
    castTimeMs: 1250,
    cooldown: 0,
    energyCost: 40,
    effects: [],
    legendId: 'LegendaryDwarf'
  },
  [ID.INSPIRING_REINFORCEMENT]: {
    castTimeMs: 250,
    cooldown: 10,
    energyCost: 30,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Inspiring Reinforcement',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 3,
        stacks: 1,
        applications: 5,
        atMs: 500,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    legendId: 'LegendaryDwarf'
  },
  [ID.SOOTHING_STONE_ID_56661]: {
    castTimeMs: 1000,
    cooldown: 30,
    energyCost: 5,
    effects: [
      {
        type: 'boon',
        boon: 'resolution',
        duration: 5,
        stacks: 1
      }
    ],
    legendId: 'LegendaryDwarf'
  },
  [ID.FORCED_ENGAGEMENT_ID_56662]: {
    castTimeMs: 500,
    cooldown: 15,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Forced Engagement',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'taunt',
        duration: 4
      }
    ],
    legendId: 'LegendaryDwarf'
  },
  [ID.VENGEFUL_HAMMERS_ID_56752]: {
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep',
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 5,
    upkeepCost: 6,
    pulseInterval: 1 / 3,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 3,
        atMs: 0,
        name: 'Vengeful Hammers',
        actorType: 'effect'
      }
    ],
    legendId: 'LegendaryDwarf'
  },
  [ID.RITE_OF_THE_GREAT_DWARF_ID_56773]: {
    castTimeMs: 1250,
    cooldown: 0,
    energyCost: 40,
    effects: [],
    legendId: 'LegendaryDwarf'
  },
  [ID.INSPIRING_REINFORCEMENT_ID_56841]: {
    castTimeMs: 250,
    cooldown: 10,
    energyCost: 30,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 40 + index * 40, coefficient: 7.5 / 5 })),
        name: 'Inspiring Reinforcement',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 3,
        stacks: 1
      }
    ],
    legendId: 'LegendaryDwarf'
  }
});
