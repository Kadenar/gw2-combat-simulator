/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { ACTOR, COMBO_FINISHER, CONDITION, STATUS, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

// The packet transform and tooltip share Backstab's intrinsic positional bonus.
export const BACKSTAB_DEFIANT_MULTIPLIER = 2;

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_DAGGER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.DOUBLE_STRIKE]: {
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 160, coefficient: 0.4 },
          { atMs: 280, coefficient: 0.4 }
        ],
        name: 'Double Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.WILD_STRIKE]: {
    cooldown: 0,
    initiativeCost: 0,
    resourceGain: 10,
    castTimeMs: 400,
    // Wild Strike commits its strike and bleeding on the ~160 ms impact before the chain animation ends.
    interruptCommitMs: 160,
    effects: impactEffects({ atMs: 160, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Wild Strike',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 2,
        duration: 3,
        actorType: ACTOR.PLAYER
      }
    ]),
    // Endurance is a commitment reward, independent of target contact.
    sideEffects: [
      { on: 'castCommit', do: { type: 'resourceGrant', resource: 'endurance', amount: { skillField: 'resourceGain' } } }
    ]
  },
  [ID.LOTUS_STRIKE]: {
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 440,
    interruptCommitMs: 280,
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Lotus Strike',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 2,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.BACKSTAB]: {
    cooldown: 1,
    initiativeCost: 0,
    requiredMainHand: WEAPON.DAGGER,
    stealthAttack: true,

    castTimeMs: 320,
    interruptCommitMs: 200,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 200, coefficient: 1.5 }],
        name: 'Front damage',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    // Apply the intrinsic factor to the current packet, retaining coefficient patch semantics.
    effectVariants: [
      {
        when: (runtime) => Boolean(runtime.config.target?.defiant),
        transform: (_runtime, _cast, effects) =>
          effects.map((effect) =>
            effect.type !== 'strike'
              ? effect
              : effect.ticks?.length
                ? {
                    ...effect,
                    ticks: effect.ticks.map((tick) => ({
                      ...tick,
                      coefficient: tick.coefficient * BACKSTAB_DEFIANT_MULTIPLIER
                    }))
                  }
                : { ...effect, coefficient: (effect.coefficient || 0) * BACKSTAB_DEFIANT_MULTIPLIER }
          )
      }
    ]
  },
  [ID.HEARTSEEKER]: {
    movementSkill: true,
    cooldown: 0,
    initiativeCost: 3,
    castTimeMs: 600,
    // Resolve the leap at impact through the shared field-selection contract.
    comboFinishers: [{ ownerId: 'thief', finisherType: COMBO_FINISHER.LEAP }],
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: 'Heartseeker',
        actorType: ACTOR.PLAYER,
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
  [ID.DEATH_BLOSSOM]: {
    // Its evasive attack can activate successful-evade effects such as Relic of the Mirage.
    evades: true,
    movementSkill: true,
    cooldown: 0,
    initiativeCost: 4,
    requiredMainHand: WEAPON.DAGGER,
    requiredOffHand: WEAPON.DAGGER,
    castTimeMs: 1040,
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: COMBO_FINISHER.WHIRL
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [560, 640, 800].map((atMs) => ({ atMs, coefficient: 0.21 })),
        name: 'Death Blossom',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [560, 640, 800].map((atMs) => ({ atMs, condition: CONDITION.BLEEDING, stacks: 2, duration: 6 })),
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.SHADOW_SHOT]: {
    movementSkill: true,
    shadowstepSkill: true,
    cooldown: 0,
    initiativeCost: 4,
    requiredMainHand: WEAPON.DAGGER,
    requiredOffHand: WEAPON.PISTOL,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.8 }],
        name: 'Shadow Shot',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.TWISTING_FANGS]: {
    cooldown: 0,
    initiativeCost: 4,
    requiredMainHand: WEAPON.DAGGER,
    requiredOffHand: false,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [200, 360].map((atMs) => ({ atMs, coefficient: 0.63 / 2 })),
        name: 'Twisting Fangs',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: CONDITION.BLEEDING, stacks: 2, duration: 10 }],
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.DANCING_DAGGER]: {
    cooldown: 0,
    initiativeCost: 3,
    // The supplied log places the projectile hit and both conditions at 280 ms within a 480 ms activation.
    castTimeMs: 480,
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        name: 'Dancing Dagger',
        actorType: ACTOR.PLAYER,
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 1,
        duration: 6,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.CLOAK_AND_DAGGER]: {
    cooldown: 0,
    initiativeCost: 5,
    // Stealth requires the dagger to land and begins before aftercast, allowing other strikes to reveal the thief.
    castTimeMs: 600,
    interruptCommitMs: 400,
    effects: impactEffects(
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 1.6,
          hits: 1,
          name: 'Cloak and Dagger',
          actorType: ACTOR.PLAYER,
          reactions: [{ on: 'damage.resolved', actor: ACTOR.PLAYER, packets: 'first', do: { type: 'thief.stealth' } }]
        },
        { type: 'buff', kind: STATUS.STEALTH, duration: 3, stacks: 1 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 5, duration: 5, actorType: ACTOR.PLAYER }
      ]
    )
  }
});
