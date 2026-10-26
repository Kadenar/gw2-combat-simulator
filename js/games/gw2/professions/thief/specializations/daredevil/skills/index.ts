import { ACTOR, CONTROL, COMBO_FINISHER, BOON, CONDITION } from '#gw2/platform/constants.js';
import { castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';

import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

// Accepted physical skills fire the point where Brawler's Tenacity grants endurance.
const PHYSICAL_ENDURANCE: NonNullable<Skill['sideEffects']> = [
  { on: 'castStart', do: { type: 'thief.physical-skill' } }
];

export const DAREDEVIL_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.IMPACT_STRIKE]: {
    cooldown: 25,
    initiativeCost: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.75 }],
        name: 'Impact Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.DAZE
      }
    ]
  },
  [ID.FINISHING_BLOW]: {
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 4 }],
        name: 'Finishing Blow',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.UPPERCUT]: {
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.25 }],
        name: 'Uppercut (Daredevil skill)',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.LAUNCH
      }
    ]
  },
  [ID.IMPAIRING_DAGGERS]: {
    cooldown: 15,
    initiativeCost: 0,
    castTimeMs: 480,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [
          { atMs: 360, coefficient: 0.75 },
          { atMs: 440, coefficient: 0.75 },
          { atMs: 520, coefficient: 1 }
        ],
        name: 'Impairing Daggers',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: CONDITION.POISONED, stacks: 3, duration: 10 }],
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: CONDITION.SLOW, stacks: 1, duration: 5 }],
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [{ atMs: 520, condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 2 }],
        actorType: ACTOR.PLAYER
      }
    ]),
    sideEffects: PHYSICAL_ENDURANCE
  },
  [ID.CHANNELED_VIGOR]: {
    cooldown: 20,
    initiativeCost: 0,
    resourceGain: 125,
    castTimeMs: 480,
    // The endurance grant commits at 440 ms, allowing the remaining cast to be interrupted.
    interruptCommitMs: 440,
    effects: [],
    // Keep the intrinsic completion grant separate from the acceptance trait reward.
    sideEffects: [
      ...PHYSICAL_ENDURANCE,
      { on: 'castCommit', do: { type: 'resourceGrant', resource: 'endurance', amount: { skillField: 'resourceGain' } } }
    ]
  },
  [ID.REFLEXIVE_STRIKE]: {
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.75 }],
        name: 'Reflexive Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.KNOCKDOWN
      }
    ],
    sideEffects: PHYSICAL_ENDURANCE
  },
  [ID.DISTRACTING_DAGGERS]: {
    cooldown: 1,
    ammo: 3,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.55 }],
        name: 'Distracting Daggers',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.DAZE
      }
    ],
    sideEffects: PHYSICAL_ENDURANCE
  },
  [ID.BANDITS_DEFENSE]: {
    cooldown: 16,
    initiativeCost: 0,
    castTimeMs: 1000,
    effects: [],
    sideEffects: PHYSICAL_ENDURANCE
  },
  [ID.PALM_STRIKE]: {
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.75 }],
        name: 'Palm Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 6.56,
        hits: 2,
        atMs: 2000,
        name: 'Pulmonary Impact',
        actorType: ACTOR.PLAYER,
        canCrit: false,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.STUN
      }
    ],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.PALM_STRIKE } }]
  },
  [ID.PULMONARY_IMPACT_TRAIT_SKILL]: {
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 3.28 }],
        name: 'Pulmonary Impact (trait skill)',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.FIST_FLURRY]: {
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    flipDuration: 5,

    cooldown: 16,
    initiativeCost: 0,
    castTimeMs: 680,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [120, 280, 400, 560, 680].map((atMs) => ({ atMs, coefficient: 0.75 })),
        name: 'Fist Flurry',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [{ atMs: 120, condition: CONDITION.VULNERABILITY, stacks: 1, duration: 5 }],
        actorType: ACTOR.PLAYER
      }
    ]),
    // Only a complete on-target flurry exposes Palm Strike; accepted casts still grant trait endurance.
    sideEffects: [
      ...PHYSICAL_ENDURANCE,
      {
        on: 'castCommit',
        when: (_runtime, cast) => cast.command.offTarget !== true && !castWasInterrupted(cast),
        do: {
          type: 'flipArm',
          skillId: ID.PALM_STRIKE
        }
      }
    ]
  },
  [ID.BOUND]: {
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 3.5 }],
        name: 'Bound',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.DASH_TRAIT_SKILL]: {
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 520,
    effects: [
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 10,
        stacks: 1
      }
    ]
  },
  [ID.IMPALING_LOTUS]: {
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 0,
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: COMBO_FINISHER.WHIRL
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [200, 360, 520].map((atMs) => ({ atMs, coefficient: 0.1875 })),
        name: 'Impaling Lotus',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 200,
            condition: CONDITION.BLEEDING,
            stacks: 2,
            duration: 4
          },
          {
            atMs: 360,
            condition: CONDITION.TORMENT,
            stacks: 2,
            duration: 4
          },
          {
            atMs: 520,
            condition: CONDITION.CRIPPLED,
            stacks: 1,
            duration: 3
          }
        ],
        actorType: ACTOR.PLAYER
      }
    ])
  }
});
