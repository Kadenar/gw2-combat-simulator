/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_DAGGER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.DOUBLE_STRIKE]: {
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 160, coefficient: 0.4 },
          { atMs: 280, coefficient: 0.4 }
        ],
        name: 'Double Strike',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.BACKSTAB]: {
    // Custom: Consumes stealth and applies Revealed after the attack through `core/live.ts`.
    castTimeMs: 320,
    interruptCommitMs: 200,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 200, coefficient: 1.5 }],
        name: 'Front damage',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Dagger',
    stealthAttack: true
  },
  [ID.DEATH_BLOSSOM]: {
    // Its evasive attack can activate successful-evade effects such as Relic of the Mirage.
    evades: true,
    movementSkill: true,
    castTimeMs: 1040,
    cooldown: 0,
    initiativeCost: 4,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [560, 640, 800].map((atMs) => ({ atMs, coefficient: 0.21 })),
        name: 'Death Blossom',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [560, 640, 800].map((atMs) => ({ atMs, condition: 'Bleeding', stacks: 2, duration: 6 })),
        actorType: 'player'
      }
    ]),
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Whirl',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    requiredMainHand: 'Dagger',
    requiredOffHand: 'Dagger'
  },
  [ID.DANCING_DAGGER]: {
    // The supplied log places the projectile hit and both conditions at 280 ms within a 480 ms activation.
    castTimeMs: 480,
    cooldown: 0,
    initiativeCost: 3,
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        name: 'Dancing Dagger',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ])
  },
  [ID.SHADOW_SHOT]: {
    movementSkill: true,
    shadowstepSkill: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.8 }],
        name: 'Shadow Shot',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'blind',
        actorType: 'player',
        duration: 5
      }
    ],
    requiredMainHand: 'Dagger',
    requiredOffHand: 'Pistol'
  },
  [ID.WILD_STRIKE]: {
    castTimeMs: 400,
    // Wild Strike commits its strike and bleeding on the ~160 ms impact before the chain animation ends.
    interruptCommitMs: 160,
    cooldown: 0,
    initiativeCost: 0,
    resourceGain: 10,
    effects: impactEffects({ atMs: 160, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Wild Strike',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 3,
        actorType: 'player'
      }
    ])
  },
  [ID.HEARTSEEKER]: {
    movementSkill: true,
    // Resolve the leap at impact through the shared field-selection contract.
    comboFinishers: [{ ownerId: 'thief', finisherType: 'Leap', ambiguousFieldSelection: 'oldest' }],
    castTimeMs: 600,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: 'Heartseeker',
        actorType: 'player',
        coefficientModifiers: [
          {
            kind: 'target-health-below',
            threshold: 0.25,
            multiplier: 2.22
          },
          {
            kind: 'target-health-below',
            threshold: 0.5,
            multiplier: 1.6
          }
        ],
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.LOTUS_STRIKE]: {
    castTimeMs: 440,
    interruptCommitMs: 280,
    cooldown: 0,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Lotus Strike',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 2,
        duration: 5,
        actorType: 'player'
      }
    ])
  },
  [ID.TWISTING_FANGS]: {
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [200, 360].map((atMs) => ({ atMs, coefficient: 0.63 / 2 })),
        name: 'Twisting Fangs',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Bleeding', stacks: 2, duration: 10 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Dagger',
    requiredOffHand: false
  },
  [ID.CLOAK_AND_DAGGER]: {
    castTimeMs: 600,
    cooldown: 0,
    initiativeCost: 5,
    // All companions resolve at cast completion; handlers retain stealth, control, and recipient rules.
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1.6, hits: 1, name: 'Cloak and Dagger', actorType: 'player' },
      { type: 'buff', kind: 'stealth', duration: 3, stacks: 1 },
      { type: 'condition', condition: 'Vulnerability', stacks: 5, duration: 5, actorType: 'player' }
    ])
  }
});
