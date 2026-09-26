/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const RANGER_CORE_SLOT_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SPIKE_TRAP]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 6,
        duration: 6
      }
    ],
    castTimeMs: 333
  },
  [ID.TROLL_UNGUENT]: {
    effects: [],
    castTimeMs: 500
  },
  [ID.HEALING_SPRING]: {
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 6
      }
    ],
    castTimeMs: 333
  },
  [ID.SIGNET_OF_THE_WILD]: {
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [520, 1520, 2520, 3520].map((atMs) => ({
          atMs,
          coefficient: 0.2
        }))
      },
      ...[520, 1520, 2520, 3520].map((atMs) => ({
        type: 'condition' as const,
        condition: 'Immobilized',
        stacks: 1,
        duration: 1,
        atMs
      }))
    ]),
    castTimeMs: 520
  },
  [ID.FROST_TRAP]: {
    interruptCommitMs: 440,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'condition',
        ticks: [880, 1880, 2880, 3880, 4880].map((atMs) => ({
          atMs,
          condition: 'Chilled',
          stacks: 1,
          duration: 2
        }))
      },
      {
        type: 'strike',
        ticks: [880, 1880, 2880, 3880, 4880].map((atMs) => ({
          atMs,
          coefficient: 1
        }))
      }
    ]),
    castTimeMs: 520,
    comboFields: [
      {
        ownerId: 'ranger',
        fieldType: 'Ice',
        duration: 5,
        startMs: 880,
        startAnchor: 'castStart'
      }
    ]
  },
  [ID.STORM_SPIRIT]: {
    // Apply vulnerability and the slam's daze before four shakes, using Sun Spirit's pulse timing.
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 10
      },
      {
        type: 'control',
        controlKind: 'daze'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 2,
        stacks: 1,
        applications: 4,
        atMs: 2840,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      }
    ],
    castTimeMs: 360
  },
  [ID.STONE_SPIRIT]: {
    effects: [
      {
        type: 'boon',
        boon: 'aegis',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 2,
        stacks: 4
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 2,
        stacks: 4
      }
    ],
    castTimeMs: 167
  },
  [ID.VIPERS_NEST]: {
    interruptCommitMs: 440,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [1400, 2400, 3400].map((atMs) => ({
          atMs,
          coefficient: 0.3
        }))
      },
      {
        type: 'condition',
        ticks: [1400, 2400, 3400].map((atMs) => ({
          atMs,
          condition: 'Poisoned',
          stacks: 2,
          duration: 8
        }))
      }
    ]),
    // Match the measured Quickness animation from the benchmark EVTC.
    castTimeMs: 600,
    comboFields: [
      {
        ownerId: 'ranger',
        fieldType: 'Poison',
        duration: 2,
        startMs: 1400,
        startAnchor: 'castStart'
      }
    ]
  },
  [ID.FROST_SPIRIT]: {
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 4,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 2,
        stacks: 4
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 2,
        stacks: 4
      }
    ],
    castTimeMs: 167
  },
  [ID.SUN_SPIRIT]: {
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 15,
        stacks: 2,
        applications: 4,
        atMs: 2840,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      },
      {
        type: 'blind',
        duration: 5
      }
    ],

    cooldown: 20,
    // Use the measured Quickness animation so later casts begin at the logged time.
    castTimeMs: 360
    // Custom: Emits Solar Flare's Burning packet; see `core/hooks.ts`.
  },
  [ID.FLAME_TRAP]: {
    interruptCommitMs: 500,
    // Arm after placement, then preserve the trap's pulses and field independently of later casts.
    // ponytail: nominal half-second pulse spacing; calibrate these offsets against a live combat log if needed.
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [520, 520, 1000, 1520, 2000, 2520].map((atMs) => ({ atMs, coefficient: 0.3 })),
        name: 'Flame Trap - Damage per Pulse'
      },
      {
        type: 'condition',
        ticks: [520, 520, 1000, 1520, 2000, 2520].map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 2.5
        }))
      }
    ]),
    comboFields: [{ ownerId: 'ranger', fieldType: 'Fire', duration: 3, startMs: 520, startAnchor: 'castEnd' }],
    castTimeMs: 333
  },
  [ID.MUDDY_TERRAIN]: {
    effects: [
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 1
      }
    ],
    castTimeMs: 500
  },
  [ID.STRENGTH_OF_THE_PACK]: {
    effects: [
      {
        type: 'buff',
        kind: 'strength-of-the-pack',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 12,
        stacks: 1,
        audience: { recipients: 'summons' as const, maximumRecipients: 2 }
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 8,
        stacks: 10,
        audience: { recipients: 'summons' as const, maximumRecipients: 2 }
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 12,
        stacks: 1,
        audience: { recipients: 'summons' as const, maximumRecipients: 2 }
      }
    ],
    castTimeMs: 667
  },
  [ID.SHARPENING_STONE]: {
    effects: [],
    castTimeMs: 0,
    canCastConcurrently: true
    // Custom: Arms Sharpening Stone charges and duration; see `core/hooks.ts`.
  },
  [ID.SPIRIT_OF_NATURE]: {
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 4
      }
    ],
    castTimeMs: 1000
  },
  [ID.ENTANGLE]: {
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [1560, 3080, 4600, 6120, 7640].map((atMs) => ({
          atMs,
          coefficient: 0.16
        }))
      },
      {
        type: 'condition',
        ticks: [1560, 3080, 4600, 6120, 7640].map((atMs) => ({
          atMs,
          condition: 'Bleeding',
          stacks: 1,
          duration: 8
        }))
      },
      {
        type: 'condition',
        ticks: [1560, 3080, 4600, 6120, 7640].map((atMs) => ({
          atMs,
          condition: 'Immobilized',
          stacks: 1,
          duration: 2
        }))
      }
    ]),
    // Match the measured Quickness animation from the benchmark EVTC.
    castTimeMs: 680
  },
  [ID.SOLAR_FLARE]: {
    // The API exposes a generic missing-icon asset, so pin the wiki's dedicated icon for result rows.
    icon: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Solar_Flare.png',
    effects: [
      // Apply each Burning stack separately so same-impact relic checks observe every application.
      ...Array.from({ length: 3 }, () => ({
        type: 'condition' as const,
        condition: 'Burning' as const,
        stacks: 1,
        duration: 6
      }))
    ],
    castTimeMs: 500
  },
  [ID.CALL_LIGHTNING]: {
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      }
    ],
    castTimeMs: 333
  },
  [ID.QUAKE]: {
    effects: [
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 6
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 6
      }
    ],
    castTimeMs: 500
  },
  [ID.COLD_SNAP]: {
    effects: [],
    castTimeMs: 500
  },
  [ID.NATURES_RENEWAL]: {
    effects: [],
    castTimeMs: 500
  },
  [ID.PROTECT_ME]: {
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 4,
        stacks: 1
      }
    ],
    castTimeMs: 333
  },
  [ID.GUARD]: {
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 1
      }
    ],
    castTimeMs: 333
  },
  [ID.SIC_EM]: {
    castTimeMs: 0,
    effects: []
    // Custom: Applies the pet-only Sic Em damage window when a pet is active; see `core/hooks.ts`.
  },
  [ID.WATER_SPIRIT]: {
    effects: [
      {
        type: 'boon',
        boon: 'vigor',
        duration: 2,
        stacks: 4
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 1,
        stacks: 4
      }
    ],
    castTimeMs: 500
  },
  [ID.AQUA_SURGE]: {
    effects: [],
    castTimeMs: 500
  },
  [ID.WE_HEAL_AS_ONE]: {
    // The replacement handler leaves these durations for the completion hook to copy active boons.
    effects: [
      { type: 'boon', boon: 'aegis', duration: 5 },
      { type: 'boon', boon: 'alacrity', duration: 3 },
      { type: 'boon', boon: 'fury', duration: 3 },
      { type: 'boon', boon: 'might', duration: 10 },
      { type: 'boon', boon: 'protection', duration: 2 },
      { type: 'boon', boon: 'quickness', duration: 2 },
      { type: 'boon', boon: 'regeneration', duration: 5 },
      { type: 'boon', boon: 'resistance', duration: 2 },
      { type: 'boon', boon: 'resolution', duration: 5 },
      { type: 'boon', boon: 'stability', duration: 3 },
      { type: 'boon', boon: 'swiftness', duration: 3 },
      { type: 'boon', boon: 'vigor', duration: 3 }
    ],
    castTimeMs: 920
  }
});
