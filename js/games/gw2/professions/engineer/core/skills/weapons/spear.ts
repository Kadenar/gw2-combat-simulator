import { ACTOR, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Defines Engineer spear fragments and declares stateful packets emitted by live spear tasks. */
export const ENGINEER_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.PUNCTURING_JAB]: {
    castTimeMs: 440,
    interruptCommitMs: 360,
    cooldown: 0,
    // Spear autoattacks land before recovery ends; strike and conditions share the measured impact.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1,
        name: 'Puncturing Jab',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 6,
        actorType: ACTOR.PLAYER
      }
    ])
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
        // Its primary impact is intrinsically an explosion for every event producer.
        damageKind: 'explosion',
        actorType: ACTOR.PLAYER,
        // Only the primary impact is the blast; focused follow-up packets must not create extra combos.
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 3,
        duration: 4,
        actorType: ACTOR.PLAYER
      }
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
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.AMPLIFYING_SLICE]: {
    castTimeMs: 640,
    interruptCommitMs: 600,
    cooldown: 0,
    // The finishing sweep applies its damage and conditions before its final recovery.
    effects: impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0.99,
        hits: 1,
        name: 'Amplifying Slice',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 2,
        duration: 6,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 2,
        duration: 6,
        actorType: ACTOR.PLAYER
      }
    ])
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
    // This derived packet is emitted by Devastator, never manually cast.
    simulatorExcluded: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 6 }, (_, index) => ({ atMs: 160 * (index + 1), coefficient: 0.2 })),
        name: 'Focused Devastation',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        // Burning owns its cadence independently of the removable strike timeline.
        atMs: 160,
        stacks: 1,
        applications: 6,
        intervalMs: 160,
        duration: 2,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.RENDING_STRIKE]: {
    castTimeMs: 520,
    // The strike lands before recovery ends; cancelling recovery still advances the spear chain.
    interruptCommitMs: 400,
    cooldown: 0,
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1,
        name: 'Rending Strike',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 6,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 8,
        actorType: ACTOR.PLAYER
      }
    ])
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
    // Releasing the projectile consumes the flip even if its final recovery is cancelled.
    interruptCommitMs: 480,
    cooldown: 1,
    effects: []
  }
});
