/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { ACTOR, BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, STATUS, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_RIFLE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.DEADLY_AIM]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    initiativeCost: 0,
    kneelSkill: true,
    castTimeMs: 600,
    interruptCommitMs: 520,
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
            chance: 0.2
          }
        ]
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
    ])
  },
  [ID.BRUTAL_AIM]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 600,
    interruptCommitMs: 520,
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
            chance: 0.2
          }
        ]
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
  [ID.DEATHS_JUDGMENT]: {
    cooldown: 1,
    initiativeCost: 0,
    requiredMainHand: WEAPON.RIFLE,
    stealthAttack: true,
    castTimeMs: 360,
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
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.32 }],
        name: 'Damage on Unmarked Foes',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SKIRMISHERS_SHOT]: {
    cooldown: 0,
    initiativeCost: 3,
    castTimeMs: 440,
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
              finisherType: COMBO_FINISHER.PROJECTILE
            }
          ]
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
  [ID.SPOTTERS_SHOT]: {
    cooldown: 0,
    initiativeCost: 3,
    kneelSkill: true,
    castTimeMs: 600,
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
              finisherType: COMBO_FINISHER.PROJECTILE
            }
          ]
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
    ]
  },
  [ID.DOUBLE_TAP]: {
    cooldown: 0,
    initiativeCost: 4,
    castTimeMs: 680,
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
            chance: 0.2
          }
        ]
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 6,
        stacks: 3
      }
    ]
  },
  [ID.THREE_ROUND_BURST]: {
    cooldown: 0,
    initiativeCost: 4,
    kneelSkill: true,
    castTimeMs: 840,
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
            chance: 0.2
          }
        ]
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 6,
        stacks: 3
      }
    ]
  },
  [ID.DEATHS_RETREAT]: {
    // The retreat shadowsteps away, so shadowstep and movement rewards (Peitha, Fluid Strikes) apply.
    movementSkill: true,
    shadowstepSkill: true,
    cooldown: 0,
    initiativeCost: 4,
    castTimeMs: 240,
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
            fieldSelectionAnchor: 'castStart'
          }
        ]
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
  [ID.SNIPERS_COVER]: {
    flipDuration: 5,
    cooldown: 0,
    initiativeCost: 4,
    kneelSkill: true,
    castTimeMs: 320,
    // The smoke field lasts through the existing five-second Death's Advance follow-up window.
    comboFields: [{ ownerId: 'thief', fieldType: COMBO_FIELD.SMOKE, duration: 5, startAnchor: 'castEnd' }],
    effects: [],
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.DEATHS_ADVANCE } }]
  },
  [ID.DEATHS_ADVANCE]: {
    cooldown: 0,
    initiativeCost: 2,
    kneelSkill: true,
    castTimeMs: 240,
    effects: [
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1
      }
    ],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [
      { on: 'castCommit', do: { type: 'flipConsume', skillId: ID.DEATHS_ADVANCE } },
      { on: 'castCommit', do: { type: 'thief.stealth' } }
    ]
  },
  [ID.KNEEL]: {
    // Kneel owns its extra recovery; Core continues to own base initiative policy.
    kneelingInitiativeRegenerationBonus: 1 / 3,
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    cooldown: 0.5,
    initiativeCost: 1,
    castTimeMs: 320,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.kneel' } }]
  },
  [ID.FREE_ACTION]: {
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    cooldown: 0,
    initiativeCost: 0,
    kneelSkill: true,
    castTimeMs: 200,
    effects: [
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 6,
        stacks: 1
      }
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.stand' } }]
  }
});
