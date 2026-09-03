/**
 * Owns Amalgam offensive and defensive protocol skill fragments across mechanic slots.
 * Evolved-state actions and persistent morph behavior live in their named owners.
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

/** Supplies every slot-specific Amalgam protocol variant to specialization composition. */
export const AMALGAM_PROTOCOL_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  [ID.OFFENSIVE_PROTOCOL_SHRED]: {
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
  [ID.DEFENSIVE_PROTOCOL_THORNS]: {
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
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH]: {
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
  [ID.DEFENSIVE_PROTOCOL_CLEANSE_ID_76798]: {
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
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76927]: {
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
    countsAsToolbeltSkill: true,
    castTimeMs: 1500,
    cooldown: 20,
    effects: [],
    mechanicSlot: 2
  },
  [ID.OFFENSIVE_PROTOCOL_PIERCE_ID_77005]: {
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
  [ID.OFFENSIVE_PROTOCOL_SHRED_ID_77103]: {
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
  [ID.DEFENSIVE_PROTOCOL_THORNS_ID_77163]: {
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
    countsAsToolbeltSkill: true,
    castTimeMs: 1500,
    cooldown: 20,
    effects: [],
    mechanicSlot: 3
  },
  [ID.DEFENSIVE_PROTOCOL_CLEANSE_ID_77285]: {
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
    countsAsToolbeltSkill: true,
    castTimeMs: 1500,
    cooldown: 20,
    effects: [],
    mechanicSlot: 4
  }
});
