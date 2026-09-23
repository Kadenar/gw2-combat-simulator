/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/** Defines Engineer spear fragments and binds stateful spear skills to their execution handlers. */
export const ENGINEER_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.PUNCTURING_JAB]: {
    castTimeMs: 440,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1,
        name: 'Puncturing Jab',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.DEVASTATOR]: {
    // Custom: Schedules Devastator's delayed follow-up strike; see `core/mechanics/spear.ts`.
    handlerId: 'engineer.devastator',
    castTimeMs: 1000,

    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Devastator',
        actorType: 'player',
        // Only the primary impact is the blast; focused follow-up packets must not create extra combos.
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      // Apply each Burning stack separately so same-impact relic checks observe every application.
      ...Array.from({ length: 3 }, () => ({
        type: 'condition' as const,
        condition: 'Burning' as const,
        stacks: 1,
        duration: 4,
        actorType: 'player' as const
      }))
    ]
  },
  [ID.ROILING_SKIES]: {
    // Custom: Schedules Roiling Skies' delayed control packet; see `core/mechanics/spear.ts`.
    handlerId: 'engineer.roiling-skies',
    castTimeMs: 680,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Roiling Skies',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  [ID.AMPLIFYING_SLICE]: {
    castTimeMs: 640,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.99,
        hits: 1,
        name: 'Amplifying Slice',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.LIGHTNING_ROD]: {
    // Custom: Schedules Lightning Rod's charge and pulse sequence; see `core/mechanics/spear.ts`.
    handlerId: 'engineer.lightning-rod',
    castTimeMs: 400,
    interruptCommitMs: 280,
    cooldown: 12,
    effects: []
  },
  [ID.FOCUSED_DEVASTATION]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 6 }, (_, index) => ({ atMs: 160 * (index + 1), coefficient: 0.2 })),
        name: 'Focused Devastation',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        // Each delayed follow-up strike applies one separate burning packet.
        stacks: 1,
        applications: 6,
        intervalMs: 160,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.RENDING_STRIKE]: {
    castTimeMs: 520,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1,
        name: 'Rending Strike',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      }
    ]
  },
  [ID.CONDUIT_SURGE]: {
    // Custom: Schedules the delayed Conduit Surge sequence; see `core/mechanics/spear.ts`.
    handlerId: 'engineer.conduit-surge',
    castTimeMs: 520,

    cooldown: 5,
    // The dash completes one leap combo at impact, where the replacement handler also applies Focused.
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: []
  },
  [ID.ELECTRIC_ARTILLERY]: {
    // Custom: Consumes Lightning Rod charges and schedules Electric Artillery; see `core/mechanics/spear.ts`.
    handlerId: 'engineer.electric-artillery',
    castTimeMs: 520,
    cooldown: 1,
    effects: []
  }
});
