import { STATUS, ACTOR, COMBO_FINISHER, COMBO_FIELD, WEAPON, BOON, CONDITION } from '#gw2/platform/constants.js';
/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_RIFLE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.DEATHS_ADVANCE]: {
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [
      { on: 'castCommit', do: { type: 'flipConsume', skillId: ID.DEATHS_ADVANCE } },
      { on: 'castCommit', do: { type: 'thief.stealth' } }
    ],
    castTimeMs: 240,
    cooldown: 0,
    initiativeCost: 2,
    effects: [
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1
      }
    ],
    kneelSkill: true
  },
  [ID.KNEEL]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.kneel' } }],

    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    castTimeMs: 320,
    cooldown: 0.5,
    initiativeCost: 1,
    effects: []
  },
  [ID.DEADLY_AIM]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    interruptCommitMs: 520,
    cooldown: 0,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1,
        name: 'Deadly Aim',
        actorType: ACTOR.PLAYER,
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 2,
        duration: 6,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 6,
        actorType: ACTOR.PLAYER
      }
    ]),
    kneelSkill: true
  },
  [ID.FREE_ACTION]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.stand' } }],

    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    castTimeMs: 200,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 6,
        stacks: 1
      }
    ],
    kneelSkill: true
  },
  [ID.BRUTAL_AIM]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    interruptCommitMs: 520,
    cooldown: 0,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Brutal Aim',
        actorType: ACTOR.PLAYER,
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 6,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 6,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.SKIRMISHERS_SHOT]: {
    castTimeMs: 440,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      ...impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 1,
          hits: 1,
          name: "Skirmisher's Shot",
          actorType: ACTOR.PLAYER,
          comboFinishers: [
            {
              ownerId: 'thief',
              finisherType: COMBO_FINISHER.PROJECTILE,
              ambiguousFieldSelection: 'oldest'
            }
          ],
          metadata: {}
        },
        {
          type: 'condition',
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 4,
          actorType: ACTOR.PLAYER
        }
      ]),
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.DEATHS_RETREAT]: {
    // The retreat shadowsteps away, so shadowstep and movement rewards (Peitha, Fluid Strikes) apply.
    movementSkill: true,
    shadowstepSkill: true,
    castTimeMs: 240,
    cooldown: 0,
    initiativeCost: 4,
    effects: impactEffects({ atMs: 160, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        name: "Death's Retreat",
        actorType: ACTOR.PLAYER,
        // Retain a field crossed during the leap even when it expires before landing.
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.LEAP,
            fieldSelectionAnchor: 'castStart',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 1,
        duration: 8,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.DOUBLE_TAP]: {
    castTimeMs: 680,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [400, 560].map((atMs) => ({ atMs, coefficient: 2.8 / 2 })),
        name: 'Double Tap',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 6,
        stacks: 3
      }
    ]
  },
  [ID.SPOTTERS_SHOT]: {
    castTimeMs: 600,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 1.3,
          hits: 1,
          name: "Spotter's Shot",
          actorType: ACTOR.PLAYER,
          comboFinishers: [
            {
              ownerId: 'thief',
              finisherType: COMBO_FINISHER.PROJECTILE,
              ambiguousFieldSelection: 'oldest'
            }
          ],
          metadata: {}
        },
        {
          type: 'condition',
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 4,
          actorType: ACTOR.PLAYER
        },
        { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 1, actorType: ACTOR.PLAYER }
      ]),
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: BOON.VIGOR,
        duration: 3,
        stacks: 1
      }
    ],
    kneelSkill: true
  },
  [ID.THREE_ROUND_BURST]: {
    castTimeMs: 840,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [400, 560, 720].map((atMs) => ({ atMs, coefficient: 2.25 / 3 })),
        name: 'Three Round Burst',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 6,
        stacks: 3
      }
    ],
    kneelSkill: true
  },
  [ID.SNIPERS_COVER]: {
    flipDuration: 5,
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.DEATHS_ADVANCE } }],
    castTimeMs: 320,
    cooldown: 0,
    initiativeCost: 4,
    // The smoke field lasts through the existing five-second Death's Advance follow-up window.
    comboFields: [{ ownerId: 'thief', fieldType: COMBO_FIELD.SMOKE, duration: 5, startAnchor: 'castEnd' }],
    effects: [],
    kneelSkill: true
  },
  [ID.DEATHS_JUDGMENT]: {
    castTimeMs: 360,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.67 }],
        name: "Death's Judgment — Packet 1",
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.PROJECTILE,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.32 }],
        name: 'Damage on Unmarked Foes',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: WEAPON.RIFLE,
    stealthAttack: true
  }
});
