/**
 * Amalgam Engineer skill mechanics.
 *
 * Weapon skills remain Core-owned because Weaponmaster Training makes the
 * physical weapon families profession-wide.
 */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';
const DEMOLISH_QUICKNESS_CAST_TIME_MS = 1000 + 560;
const DEMOLISH_RECHARGE_OFFSET_MS = 1000;
// EVTC splits Demolish into a one-second spin and a 560 ms smash; fixed packet
// timestamps preserve the observed animation hits under Quickness.
const DEMOLISH_SPIN_TICKS = Object.freeze([
  { atMs: 360, coefficient: 0.9 },
  { atMs: 640, coefficient: 0.9 },
  { atMs: 920, coefficient: 0.9 }
]);
const DEMOLISH_SMASH_AT_MS = 1440;
const PLASMATIC_STATE_QUICKNESS_CAST_TIME_MS = 480 + 480;
const PLASMATIC_STATE_RECHARGE_OFFSET_MS = 480;
// Amalgam's F2-F5 mechanics replace tool-belt slots, so their own metadata opts them into Tools trait interactions.
export const AMALGAM_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  [ID.OFFENSIVE_PROTOCOL_SHRED]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    quicknessCastTimeMs: 760,
    cooldown: 20,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Projectile',
        preferredFieldTypes: ['Fire'],
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 638.4, coefficient: 0.96 },
          { atMs: 684, coefficient: 0.96 },
          { atMs: 729.6, coefficient: 0.96 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Offensive Protocol: Shred',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ],
    mechanicSlot: 4
  },
  [ID.SYMBIOTIC_SHIELDING]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 25,
    effects: [],
    toolbeltParentName: 'Mitotic State',
    mechanicSlot: 1
  },
  [ID.DEFENSIVE_PROTOCOL_THORNS]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    // Custom: Activates the selected morph, strain, and form-specific effects; see `amalgam/mechanics/evolved-form.ts`.
    handlerId: 'engineer.amalgam-morph',
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Initial Damage',
        actorType: 'player'
      }
    ],
    mechanicSlot: 4
  },
  [ID.EVOLVE]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    // Custom: Consumes the selected strain and enters Evolved form; see `amalgam/mechanics/evolved-form.ts`.
    handlerId: 'engineer.evolve',
    quicknessCastTimeMs: 640,
    cooldown: 40,
    effects: [],
    mechanicSlot: 5
  },
  [ID.EVOLVE_ID_76651]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    // Custom: Consumes the selected strain and enters Evolved form; see `amalgam/mechanics/evolved-form.ts`.
    handlerId: 'engineer.evolve',
    quicknessCastTimeMs: 640,
    cooldown: 40,
    ammo: 2,
    effects: [],
    mechanicSlot: 5
  },
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    quicknessCastTimeMs: DEMOLISH_QUICKNESS_CAST_TIME_MS,
    cooldown: 20,
    rechargeAnchor: 'castStart',
    rechargeOffsetMs: DEMOLISH_RECHARGE_OFFSET_MS,
    effects: [
      {
        type: 'strike',
        ticks: DEMOLISH_SPIN_TICKS,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Offensive Protocol: Demolish — Packet 1',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Whirl',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'strike',
        ticks: [{ atMs: DEMOLISH_SMASH_AT_MS, coefficient: 2.25 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Smash Damage',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }
    ],
    mechanicSlot: 3
  },
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    quicknessCastTimeMs: 800,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 640, coefficient: 2.88 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Offensive Protocol: Obliterate',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 640, condition: 'Bleeding', stacks: 8, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ],
    mechanicSlot: 4
  },
  [ID.DEFENSIVE_PROTOCOL_CLEANSE]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 3,
        stacks: 1
      }
    ],
    mechanicSlot: 4
  },
  [ID.MITOTIC_STATE]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 20,
    effects: []
  },
  [ID.LOCKED]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.DEFENSIVE_PROTOCOL_CLEANSE_ID_76798]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 3,
        stacks: 1
      }
    ],
    mechanicSlot: 2
  },
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE_ID_76806]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    quicknessCastTimeMs: 800,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 640, coefficient: 2.88 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Offensive Protocol: Obliterate',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 640, condition: 'Bleeding', stacks: 8, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ],
    mechanicSlot: 2
  },
  [ID.OFFENSIVE_PROTOCOL_PIERCE]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    castTimeMs: 1000,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 2.88,
        hits: 1,
        name: 'Offensive Protocol: Pierce',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'stun',
        duration: 2
      }
    ],
    mechanicSlot: 2
  },
  [ID.OFFENSIVE_PROTOCOL_SHRED_ID_76866]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    quicknessCastTimeMs: 760,
    cooldown: 20,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Projectile',
        preferredFieldTypes: ['Fire'],
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 638.4, coefficient: 0.96 },
          { atMs: 684, coefficient: 0.96 },
          { atMs: 729.6, coefficient: 0.96 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Offensive Protocol: Shred',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ],
    mechanicSlot: 3
  },
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE_ID_76901]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    quicknessCastTimeMs: 800,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 640, coefficient: 2.88 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Offensive Protocol: Obliterate',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 640, condition: 'Bleeding', stacks: 8, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ],
    mechanicSlot: 3
  },
  [ID.LIQUID_STATE]: {
    implemented: true,
    castTimeMs: 1500,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 4 }, (_, index) => ({ atMs: 250 + index * 250, coefficient: 3.2 / 4 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Liquid State',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 4,
        duration: 12,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 4,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76927]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    quicknessCastTimeMs: DEMOLISH_QUICKNESS_CAST_TIME_MS,
    cooldown: 20,
    rechargeAnchor: 'castStart',
    rechargeOffsetMs: DEMOLISH_RECHARGE_OFFSET_MS,
    effects: [
      {
        type: 'strike',
        ticks: DEMOLISH_SPIN_TICKS,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Offensive Protocol: Demolish — Packet 1',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Whirl',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'strike',
        ticks: [{ atMs: DEMOLISH_SMASH_AT_MS, coefficient: 2.25 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Smash Damage',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }
    ],
    mechanicSlot: 2
  },
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76954]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    quicknessCastTimeMs: DEMOLISH_QUICKNESS_CAST_TIME_MS,
    cooldown: 20,
    rechargeAnchor: 'castStart',
    rechargeOffsetMs: DEMOLISH_RECHARGE_OFFSET_MS,
    effects: [
      {
        type: 'strike',
        ticks: DEMOLISH_SPIN_TICKS,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Offensive Protocol: Demolish — Packet 1',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Whirl',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'strike',
        ticks: [{ atMs: DEMOLISH_SMASH_AT_MS, coefficient: 2.25 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Smash Damage',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }
    ],
    mechanicSlot: 4
  },
  [ID.DEFENSIVE_PROTOCOL_PROTECT]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    castTimeMs: 1500,
    cooldown: 20,
    effects: [],
    mechanicSlot: 2
  },
  [ID.FLUX_STATE]: {
    implemented: true,
    quicknessCastTimeMs: 640,
    cooldown: 50,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Flux State — Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        // EVTC field packets land on a measured ~520 ms cadence; preserving
        // it also prevents exact-boundary distortion for 0.5-second ICDs.
        ticks: Array.from({ length: 12 }, (_, index) => ({ atMs: 520 + index * 520, coefficient: 9 / 12 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Storm Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 520, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 1040, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 1560, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 2080, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 2600, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 3120, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 3640, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 4160, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 4680, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 5200, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 5720, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 6240, condition: 'Bleeding', stacks: 1, duration: 5 }
        ],
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'pull',
        duration: 360
      }
    ]
  },
  [ID.OFFENSIVE_PROTOCOL_PIERCE_ID_77005]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    castTimeMs: 1000,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 2.88,
        hits: 1,
        name: 'Offensive Protocol: Pierce',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'stun',
        duration: 2
      }
    ],
    mechanicSlot: 3
  },
  [ID.OFFENSIVE_PROTOCOL_PIERCE_ID_77015]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    castTimeMs: 1000,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 2.88,
        hits: 1,
        name: 'Offensive Protocol: Pierce',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'stun',
        duration: 2
      }
    ],
    mechanicSlot: 4
  },
  [ID.SOLID_STATE]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 25,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Solid State',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'stun',
        duration: 2
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 5,
        stacks: 5
      }
    ]
  },
  [ID.OFFENSIVE_PROTOCOL_SHRED_ID_77103]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    quicknessCastTimeMs: 760,
    cooldown: 20,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Projectile',
        preferredFieldTypes: ['Fire'],
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 638.4, coefficient: 0.96 },
          { atMs: 684, coefficient: 0.96 },
          { atMs: 729.6, coefficient: 0.96 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Offensive Protocol: Shred',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ],
    mechanicSlot: 2
  },
  [ID.DEFENSIVE_PROTOCOL_THORNS_ID_77104]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    // Custom: Activates the selected morph, strain, and form-specific effects; see `amalgam/mechanics/evolved-form.ts`.
    handlerId: 'engineer.amalgam-morph',
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Initial Damage',
        actorType: 'player'
      }
    ],
    mechanicSlot: 3
  },
  [ID.LOCKED_ID_77107]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.DEFENSIVE_PROTOCOL_THORNS_ID_77163]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    // Custom: Activates the selected morph, strain, and form-specific effects; see `amalgam/mechanics/evolved-form.ts`.
    handlerId: 'engineer.amalgam-morph',
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Initial Damage',
        actorType: 'player'
      }
    ],
    mechanicSlot: 2
  },
  [ID.DEFENSIVE_PROTOCOL_PROTECT_ID_77203]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    castTimeMs: 1500,
    cooldown: 20,
    effects: [],
    mechanicSlot: 3
  },
  [ID.PLASMATIC_STATE]: {
    implemented: true,
    interruptCommitMs: 0,
    // Custom: Activates Plasmatic State and its duration/state event; see `amalgam/mechanics/evolved-form.ts`.
    handlerId: 'engineer.plasmatic-state',
    quicknessCastTimeMs: PLASMATIC_STATE_QUICKNESS_CAST_TIME_MS,
    cooldown: 25,
    rechargeAnchor: 'castStart',
    rechargeOffsetMs: PLASMATIC_STATE_RECHARGE_OFFSET_MS,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 426.666666666667, coefficient: 2.25 },
          { atMs: 786.666666666667, coefficient: 2.25 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Plasmatic State',
        actorType: 'player',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 426.666666666667, condition: 'Burning', stacks: 2, duration: 5 },
          { atMs: 786.666666666667, condition: 'Burning', stacks: 2, duration: 5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        actorType: 'player',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.DEFENSIVE_PROTOCOL_CLEANSE_ID_77285]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 3,
        stacks: 1
      }
    ],
    mechanicSlot: 3
  },
  [ID.DEFENSIVE_PROTOCOL_PROTECT_ID_77358]: {
    implemented: true,
    countsAsToolbeltSkill: true,
    castTimeMs: 1500,
    cooldown: 20,
    effects: [],
    mechanicSlot: 4
  },
  [ID.LOCKED_ID_77388]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  }
});
