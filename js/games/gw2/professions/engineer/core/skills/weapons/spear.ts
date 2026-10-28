/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ACTOR, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Defines Engineer spear fragments and declares stateful packets emitted by live spear tasks. */
export const ENGINEER_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, Partial<EngineerSkill>>> = Object.freeze({
  [ID.PUNCTURING_JAB]: {
    cooldown: 0,
    castTimeMs: 440,
    interruptCommitMs: 360,
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
  [ID.RENDING_STRIKE]: {
    cooldown: 0,
    castTimeMs: 520,
    // The strike lands before recovery ends; cancelling recovery still advances the spear chain.
    interruptCommitMs: 400,
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
  [ID.AMPLIFYING_SLICE]: {
    cooldown: 0,
    castTimeMs: 640,
    interruptCommitMs: 600,
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
  [ID.CONDUIT_SURGE]: {
    // Intrinsic tuning follows this selected skill through patches and deferred work.
    duration: 10,

    cooldown: 5,
    castTimeMs: 520,
    effects: [],

    // Resolve the committed impact through the owner that establishes the target's Focused window.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'engineer.conduit-surge',
          id: 'payload',
          effects: [
            {
              name: 'Conduit Surge',
              type: 'strike',
              coefficient: 1.2,
              hits: 1
            },
            {
              name: 'Burning',
              type: 'condition',
              condition: CONDITION.BURNING,
              stacks: 1,
              duration: 7
            }
          ]
        }
      }
    ]
  },
  [ID.LIGHTNING_ROD]: {
    cooldown: 12,
    castTimeMs: 400,
    interruptCommitMs: 280,
    effects: [],
    // Replace the owned pulse sequence and arm Artillery's delayed follow-up window on commitment.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'engineer.lightning-rod',
          id: 'payload',
          effects: [
            {
              name: 'Lightning Rod Pulse',
              type: 'strike',
              coefficient: 0.17,
              hits: 1
            },
            {
              name: 'Vulnerability',
              type: 'condition',
              condition: CONDITION.VULNERABILITY,
              stacks: 1,
              duration: 8
            },
            {
              name: 'Focused Lightning Rod Pulse',
              type: 'strike',
              coefficient: 0.3,
              hits: 1
            },
            {
              name: 'Focused Vulnerability',
              type: 'condition',
              condition: CONDITION.VULNERABILITY,
              stacks: 2,
              duration: 8
            }
          ]
        }
      }
    ]
  },
  [ID.ELECTRIC_ARTILLERY]: {
    // Intrinsic tuning follows this selected skill through patches and deferred work.
    maximumStacks: 12,
    chargesPerVulnerability: 2,
    burningDurationPerCharge: 0.25,
    focusedChargesPerVulnerability: 1,
    focusedBurningDurationPerCharge: 0.5,
    cooldown: 1,
    castTimeMs: 520,
    // Releasing the projectile consumes the flip even if its final recovery is cancelled.
    interruptCommitMs: 480,
    effects: [],

    // Snapshot charges at release, then retire Lightning Rod while the launched projectile remains pending.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'engineer.electric-artillery',
          id: 'payload',
          effects: [
            {
              name: 'Electric Artillery',
              type: 'strike',
              coefficient: 1,
              hits: 1
            },
            {
              name: 'Immobilized',
              type: 'condition',
              condition: CONDITION.IMMOBILIZED,
              stacks: 1,
              duration: 2
            },
            {
              name: 'Vulnerability',
              type: 'condition',
              condition: CONDITION.VULNERABILITY,
              stacks: 1,
              duration: 8
            },
            {
              name: 'Burning',
              type: 'condition',
              condition: CONDITION.BURNING,
              stacks: 2,
              duration: 3
            },
            {
              name: 'Focused Electric Artillery',
              type: 'strike',
              coefficient: 1.5,
              hits: 1
            },
            {
              name: 'Focused Immobilized',
              type: 'condition',
              condition: CONDITION.IMMOBILIZED,
              stacks: 1,
              duration: 2
            },
            {
              name: 'Focused Vulnerability',
              type: 'condition',
              condition: CONDITION.VULNERABILITY,
              stacks: 1,
              duration: 8
            },
            {
              name: 'Focused Burning',
              type: 'condition',
              condition: CONDITION.BURNING,
              stacks: 2,
              duration: 3
            }
          ]
        }
      }
    ]
  },
  [ID.ROILING_SKIES]: {
    cooldown: 15,
    castTimeMs: 680,
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
    ],
    // Select launch or stun from the live Focused state when the cast commits.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.roiling-skies' } }]
  },
  [ID.DEVASTATOR]: {
    // Check Focused at the reserved cast end before emitting the delayed follow-up.
    tasks: [{ type: 'engineer.devastation', timingAnchor: 'castEnd' }],

    cooldown: 20,
    castTimeMs: 1000,
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
  [ID.FOCUSED_DEVASTATION]: {
    // This derived packet is emitted by Devastator, never manually cast.
    simulatorExcluded: true,
    cooldown: 0,
    castTimeMs: 0,
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
  }
});
