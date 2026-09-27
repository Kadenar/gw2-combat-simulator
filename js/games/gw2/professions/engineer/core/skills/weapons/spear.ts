/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/** Defines Engineer spear fragments and declares stateful packets emitted by live spear tasks. */
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
    // Check Focused at the reserved cast end before emitting the delayed follow-up.
    tasks: [{ type: 'engineer.devastation', timingAnchor: 'castEnd' }],
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
    // Select launch or stun from the live Focused state when the cast commits.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.roiling-skies' } }],
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
    // Replace the owned pulse sequence and arm Artillery's delayed follow-up window on commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.lightning-rod' } }],
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
        // Burning owns its cadence independently of the removable strike timeline.
        atMs: 160,
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
    // Resolve the committed impact through the owner that establishes the target's Focused window.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.conduit-surge' } }],
    castTimeMs: 520,

    cooldown: 5,
    effects: []
  },
  [ID.ELECTRIC_ARTILLERY]: {
    // Snapshot charges at release, then retire Lightning Rod while the launched projectile remains pending.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.electric-artillery' } }],
    castTimeMs: 520,
    cooldown: 1,
    effects: []
  }
});
