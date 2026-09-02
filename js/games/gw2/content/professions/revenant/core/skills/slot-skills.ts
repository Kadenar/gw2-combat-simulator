/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const REVENANT_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.VENGEFUL_HAMMERS]: {
    implemented: true,
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
    implemented: true,
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
  [ID.RESIST_THE_DARKNESS]: {
    implemented: true,
    // Custom: Releases the active upkeep skill and exposes its parent again; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep-release',
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [],
    legendId: 'LegendaryDemon'
  },
  [ID.PROTECTIVE_SOLACE]: {
    implemented: true,
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
  [ID.ENCHANTED_DAGGERS]: {
    implemented: true,
    // Custom: Arms Enchanted Daggers charges and their strike-triggered healing state; see `core/skills/assassin.ts`.
    handlerId: 'revenant.enchanted-daggers',
    castTimeMs: 500,
    cooldown: 30,
    energyCost: 5,
    effects: [
      {
        type: 'buff',
        kind: 'enchanted-daggers',
        duration: 15,
        stacks: 6,
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        atMs: 500,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        flatStrikeBase: 1028,
        flatStrikePowerCoeff: 0.06,
        name: 'Enchanted Daggers — Siphon Damage',
        actorType: 'effect'
      }
    ],
    legendId: 'LegendaryAssassin'
  },
  [ID.RELEASE_HAMMERS]: {
    implemented: true,
    // Custom: Releases the active upkeep skill and exposes its parent again; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep-release',
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [],
    legendId: 'LegendaryDwarf'
  },
  [ID.NATURAL_HARMONY]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 2,
    energyCost: 20,
    effects: [],
    legendId: 'LegendaryCentaur'
  },
  [ID.IMPOSSIBLE_ODDS]: {
    implemented: true,
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep',
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 5,
    upkeepCost: 6,
    manualReleaseCooldown: 1,
    starvationCooldown: 4,
    pulseInterval: 1,
    // Triggered strikes use a separate quarter-second ICD from the upkeep pulse.
    triggerIntervalMs: 250,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 250, coefficient: 0.65 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Impossible Odds',
        actorType: 'effect'
      }
    ],
    legendId: 'LegendaryAssassin'
  },
  [ID.PAIN_ABSORPTION]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    energyCost: 30,
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 1,
        stacks: 1
      }
    ],
    legendId: 'LegendaryDemon'
  },
  [ID.ENERGY_EXPULSION]: {
    implemented: true,
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
  [ID.SOOTHING_STONE]: {
    implemented: true,
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
  [ID.BANISH_ENCHANTMENT]: {
    interruptCommitMs: 0,
    implemented: true,
    quicknessCastTimeMs: 440,
    cooldown: 0,
    energyCost: 20,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 3 }, (_, index) => ({ atMs: 402 + index * 119, coefficient: 1.2 / 3 })),
        name: 'Banish Enchantment',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {}
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 3 }, (_, index) => ({
          atMs: 402 + index * 119,
          condition: 'Chilled',
          stacks: 1,
          duration: 1
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {},
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 3 }, (_, index) => ({
          atMs: 402 + index * 119,
          condition: 'Torment',
          stacks: 1,
          duration: 3
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {},
        actorType: 'player'
      }
    ],
    legendId: 'LegendaryDemon'
  },
  [ID.DIMINISH_SOLACE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 5,
    energyCost: 0,
    effects: []
  },
  [ID.PURIFYING_ESSENCE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 5,
    energyCost: 25,
    effects: [],
    legendId: 'LegendaryCentaur'
  },
  [ID.CALL_TO_ANGUISH]: {
    interruptCommitMs: 0,
    implemented: true,
    quicknessCastTimeMs: 820,
    cooldown: 3,
    energyCost: 30,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 804, coefficient: 1.2 }],
        name: 'Call to Anguish',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [{ atMs: 804, condition: 'Chilled', stacks: 1, duration: 2 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {}
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 804,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        controlKind: 'pull',
        duration: 360
      }
    ],
    legendId: 'LegendaryDemon'
  },
  [ID.RITE_OF_THE_GREAT_DWARF]: {
    implemented: true,
    castTimeMs: 1250,
    cooldown: 0,
    energyCost: 40,
    effects: [],
    legendId: 'LegendaryDwarf'
  },
  [ID.EMPOWERING_MISERY]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 30,
    energyCost: 5,
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 1
      }
    ],
    legendId: 'LegendaryDemon'
  },
  [ID.PHASE_TRAVERSAL]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 5,
    energyCost: 30,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Phase Traversal',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        stacks: 1
      }
    ],
    legendId: 'LegendaryAssassin'
  },
  [ID.EMBRACE_THE_DARKNESS]: {
    implemented: true,
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep',
    quicknessCastTimeMs: 440,
    cooldown: 3,
    energyCost: 5,
    upkeepCost: 6,
    pulseInterval: 1,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 362, coefficient: 0.3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Embrace the Darkness',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 5,
        actorType: 'player',
        metadata: { trigger: 'empowered-upkeep-pulse' }
      }
    ],
    legendId: 'LegendaryDemon'
  },
  [ID.RELINQUISH_POWER]: {
    implemented: true,
    // Custom: Releases the active upkeep skill and exposes its parent again; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep-release',
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [],
    legendId: 'LegendaryAssassin'
  },
  [ID.JADE_WINDS]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 10,
    energyCost: 35,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Jade Winds',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 6,
        duration: 6,
        actorType: 'player'
      }
    ],
    legendId: 'LegendaryAssassin'
  },
  [ID.VENTARIS_WILL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0.25,
    energyCost: 0,
    effects: [],
    legendId: 'LegendaryCentaur'
  },
  [ID.INSPIRING_REINFORCEMENT]: {
    implemented: true,
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
  [ID.PROJECT_TRANQUILITY]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 2,
    energyCost: 0,
    effects: [],
    legendId: 'LegendaryCentaur'
  },
  [ID.RIPOSTING_SHADOWS]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 30,
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 6,
        stacks: 1
      }
    ],
    legendId: 'LegendaryAssassin'
  },
  [ID.PROTECTIVE_SOLACE_ID_29310]: {
    implemented: true,
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
  [ID.JADE_WINDS_ID_31294]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 10,
    energyCost: 35,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Jade Winds',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 6,
        duration: 6,
        actorType: 'player'
      }
    ],
    legendId: 'LegendaryAssassin'
  },
  [ID.SOOTHING_STONE_ID_56661]: {
    implemented: true,
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
    implemented: true,
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
    implemented: true,
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
    implemented: true,
    castTimeMs: 1250,
    cooldown: 0,
    energyCost: 40,
    effects: [],
    legendId: 'LegendaryDwarf'
  },
  [ID.INSPIRING_REINFORCEMENT_ID_56841]: {
    implemented: true,
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
  },
  [ID.UNYIELDING_IMPACT]: {
    implemented: true,
    quicknessCastTimeMs: 920,
    cooldown: 0,
    energyCost: 5,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 557, coefficient: 1 }],
        name: 'Unyielding Impact',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 557, condition: 'Burning', stacks: 1, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 557, condition: 'Torment', stacks: 4, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 557, condition: 'Poisoned', stacks: 1, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    legendId: 'LegendaryDemon'
  }
});
