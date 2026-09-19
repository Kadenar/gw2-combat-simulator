/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const WARRIOR_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.HAMSTRING]: {
    castTimeMs: 400,
    dualWieldCastTimeMs: 320,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.2
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 1
      }
    ])
  },
  [ID.SEVER_ARTERY]: {
    castTimeMs: 360,
    dualWieldCastTimeMs: 280,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0.8
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6
      }
    ])
  },
  [ID.GASH]: {
    // Gash occupies the default cast lane for 560 ms, including retained aftercast.
    castTimeMs: 560,
    dualWieldCastTimeMs: 360,
    interruptCommitMs: 360,
    retainsCastLockoutAfterInterrupt: true,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0.8
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6
      }
    ])
  },
  [ID.SAVAGE_LEAP]: {
    // Retain a field crossed during the leap even when it expires before landing.
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Leap',
        fieldSelectionAnchor: 'castStart',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    castTimeMs: 1000,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 5
      }
    ])
  },
  [ID.RIPOSTE]: {
    castTimeMs: 1500,
    effects: []
  },
  [ID.IMPALE]: {
    castTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 5,
        duration: 8
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 1,
        applications: 5,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.RIP]: {
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 10
      }
    ]
  },
  [ID.ADRENALINE_RUSH]: {
    castTimeMs: 333,
    adrenalineGain: 3,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  },
  [ID.REND]: {
    castTimeMs: 960,
    dualWieldCastTimeMs: 720,
    // Interrupted replay keeps every Rend packet after its two-part attack commits.
    interruptCommitMs: 920,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [{ atMs: 440, coefficient: 0.5 }]
      },
      {
        type: 'strike',
        ticks: [{ atMs: 880, coefficient: 2.5 }],
        name: 'Rend — Follow-Up Damage'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: 'Immobilized', stacks: 1, duration: 2 }]
      },
      {
        type: 'condition',
        ticks: [{ atMs: 880, condition: 'Bleeding', stacks: 6, duration: 6 }]
      }
    ])
  }
});
