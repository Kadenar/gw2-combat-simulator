import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Shadow Shroud entry and exit are state-selected variants of one UI tile.
const SHADOW_SHROUD_PALETTE_TILE = 'specter-shadow-shroud';

export const SPECTER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SIPHON]: {
    stealTraitSkill: true,
    // Siphon adds Lead Attacks and Sleight of Hand reductions instead of multiplying them.
    stealRechargeMode: 'additive',
    // Custom: Runs steal traits, grants the stolen skill, and updates shadow force; see `specter/execution/index.ts`.
    handlerId: 'thief.siphon',
    quicknessCastTimeMs: 520,
    cooldown: 18,
    initiativeCost: 0,
    effects: [
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Slow', stacks: 1, duration: 5 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.ENTER_SHADOW_SHROUD]: {
    // Custom: Enters Shadow Shroud and starts shadow-force drain; see `specter/mechanics/shadow-shroud.ts`.
    handlerId: 'thief.shadow-shroud-enter',
    castTimeMs: 0,
    cooldown: 8,
    paletteTileId: SHADOW_SHROUD_PALETTE_TILE,
    paletteTileOrder: 1,
    initiativeCost: 0,
    effects: []
  },
  [ID.ETERNAL_NIGHT]: {
    // Custom: Applies Shadow Shroud skill trait effects after the cast; see `specter/execution/index.ts`.
    handlerId: 'thief.shadow-shroud-skill',
    quicknessCastTimeMs: 740,
    cooldown: 8,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 2 }, (_, index) => ({ atMs: 360 + index * 320, coefficient: 3.5 / 2 })),
        name: 'Eternal Night',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: 'Chilled', stacks: 1, duration: 2 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 680, condition: 'Weakness', stacks: 1, duration: 4 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 360, condition: 'Poisoned', stacks: 2, duration: 4 },
          { atMs: 680, condition: 'Poisoned', stacks: 2, duration: 4 }
        ],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    shadowShroudSkill: true
  },
  [ID.GRASPING_SHADOWS]: {
    // Custom: Applies Shadow Shroud skill trait effects after the cast; see `specter/execution/index.ts`.
    handlerId: 'thief.shadow-shroud-skill',
    quicknessCastTimeMs: 240,
    cooldown: 3,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 1000, coefficient: 1.66 }],
        name: 'Grasping Shadows',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1000, condition: 'Crippled', stacks: 1, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1000, condition: 'Torment', stacks: 2, duration: 6 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    shadowShroudSkill: true
  },
  [ID.DAWNS_REPOSE]: {
    // Custom: Applies Shadow Shroud skill trait effects after the cast; see `specter/execution/index.ts`.
    handlerId: 'thief.shadow-shroud-skill',
    quicknessCastTimeMs: 520,
    cooldown: 8,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: "Dawn's Repose",
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'fear',
        duration: 1
      }
    ],
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    shadowShroudSkill: true
  },
  [ID.WELL_OF_SILENCE]: {
    movementSkill: true,
    castTimeMs: 500,
    cooldown: 25,
    initiativeCost: 0,
    effects: [
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'daze',
        duration: 2
      }
    ]
  },
  [ID.MIND_SHOCK]: {
    // Custom: Applies Shadow Shroud skill trait effects after the cast; see `specter/execution/index.ts`.
    handlerId: 'thief.shadow-shroud-skill',
    quicknessCastTimeMs: 360,
    cooldown: 16,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 3000, coefficient: 2 }],
        name: 'Mind Shock',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 4,
        stacks: 3
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 3000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        controlKind: 'stun'
      }
    ],
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    shadowShroudSkill: true
  },
  [ID.EXIT_SHADOW_SHROUD]: {
    // Custom: Leaves Shadow Shroud and stops its drain; see `specter/mechanics/shadow-shroud.ts`.
    handlerId: 'thief.shadow-shroud-exit',
    castTimeMs: 0,
    cooldown: 0,
    paletteTileId: SHADOW_SHROUD_PALETTE_TILE,
    paletteTileOrder: 2,
    initiativeCost: 0,
    effects: []
  },
  [ID.SHADOWFALL]: {
    castTimeMs: 500,
    cooldown: 75,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 3 }, (_, index) => ({ atMs: 120.24 + index * 120.24, coefficient: 4.5 / 3 })),
        name: 'Shadowfall',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'pull',
        duration: 1
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'pull',
        duration: 50
      }
    ]
  },
  [ID.WELL_OF_SORROW]: {
    interruptCommitMs: 0,
    movementSkill: true,
    shadowstepSkill: true,
    quicknessCastTimeMs: 600,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 400 + index * 1000, coefficient: 1.11 / 5 })),
        name: 'Well of Sorrow',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 400, condition: 'Torment', stacks: 2, duration: 6 },
          { atMs: 1400, condition: 'Bleeding', stacks: 3, duration: 6 },
          { atMs: 2400, condition: 'Torment', stacks: 2, duration: 6 },
          { atMs: 3400, condition: 'Poisoned', stacks: 3, duration: 6 },
          { atMs: 4400, condition: 'Torment', stacks: 2, duration: 6 }
        ],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.WELL_OF_GLOOM]: {
    movementSkill: true,
    castTimeMs: 1000,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Crippled', stacks: 1, duration: 2 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.WELL_OF_TEARS]: {
    interruptCommitMs: 0,
    movementSkill: true,
    shadowstepSkill: true,
    quicknessCastTimeMs: 600,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 0 + index * 1000, coefficient: 5 / 5 })),
        name: 'Well of Tears',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.WELL_OF_BOUNTY]: {
    interruptCommitMs: 0,
    movementSkill: true,
    shadowstepSkill: true,
    quicknessCastTimeMs: 400,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'stability',
        duration: 5,
        stacks: 2,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 15,
        stacks: 8,
        atMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 5,
        stacks: 1,
        atMs: 2000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 8,
        stacks: 1,
        atMs: 3000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 12,
        stacks: 1,
        atMs: 4000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.HAUNT_SHOT]: {
    // Custom: Applies Shadow Shroud skill trait effects after the cast; see `specter/execution/index.ts`.
    handlerId: 'thief.shadow-shroud-skill',
    quicknessCastTimeMs: 640,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 560, coefficient: 1.075 }],
        name: 'Haunt Shot',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 560, condition: 'Torment', stacks: 1, duration: 6 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 1
      }
    ],
    shadowShroudSkill: true
  }
});
