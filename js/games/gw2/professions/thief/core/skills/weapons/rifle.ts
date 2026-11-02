/** Canonical Core thief skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, STATUS, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_RIFLE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ThiefSkill>>> = {
  [ID.DEADLY_AIM]: {
    name: 'Deadly Aim',
    icon: 'https://render.guildwars2.com/file/4E3F0B6E685229564C5E023C1367B257EA20D141/1770621.png',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Rifle',

    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
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
    name: 'Brutal Aim',
    icon: 'https://render.guildwars2.com/file/03A49460B608436CF3B0072F2E4129F11ABB3DE8/1770622.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
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
    name: "Death's Judgment",
    icon: 'https://render.guildwars2.com/file/C7FDA946603F56590400096DB95FF366090E740B/3098876.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_1',
    cooldown: 1,
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
    name: "Skirmisher's Shot",
    icon: 'https://render.guildwars2.com/file/C4CB4C106624CE97BDDB0F44E1C2B2E1E1DA3337/1770625.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_2',
    cost: { resource: 'initiative', amount: 3 },

    cooldown: 0,
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
    name: "Spotter's Shot",
    icon: 'https://render.guildwars2.com/file/0CFD156D4CF5F17EA13952B6083CAE04E1601B5E/1770624.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_2',
    cost: { resource: 'initiative', amount: 3 },

    cooldown: 0,
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
    name: 'Double Tap',
    icon: 'https://render.guildwars2.com/file/3DAF4EF37FE4D5966596545D2A1B445564090E66/1770627.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_3',
    cost: { resource: 'initiative', amount: 4 },

    cooldown: 0,
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
    name: 'Three Round Burst',
    icon: 'https://render.guildwars2.com/file/55013868E7A03E437305D7B706EB042A35172450/1770626.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_3',
    cost: { resource: 'initiative', amount: 4 },

    cooldown: 0,
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
    name: "Death's Retreat",
    icon: 'https://render.guildwars2.com/file/BBAD4B7DA7187A9A09E01E6A11D74962A7050B44/1770629.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_4',
    cost: { resource: 'initiative', amount: 4 },

    // The retreat shadowsteps away, so shadowstep and movement rewards (Peitha, Fluid Strikes) apply.
    movementSkill: true,
    shadowstepSkill: true,
    cooldown: 0,
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
    name: "Sniper's Cover",
    icon: 'https://render.guildwars2.com/file/21A0A255EA0126D30453CAE6CC40DF0B0B70B2ED/1770632.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_4',
    cost: { resource: 'initiative', amount: 4 },

    flipDuration: 5,
    cooldown: 0,
    kneelSkill: true,
    castTimeMs: 320,
    // The smoke field lasts through the existing five-second Death's Advance follow-up window.
    comboFields: [{ ownerId: 'thief', fieldType: COMBO_FIELD.SMOKE, duration: 5, startAnchor: 'castEnd' }],
    effects: [],
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.DEATHS_ADVANCE } }]
  },
  [ID.DEATHS_ADVANCE]: {
    name: "Death's Advance",
    icon: 'https://render.guildwars2.com/file/F66C0938F052950905AE804BB4C495CBF6AD36AF/2779165.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_4',
    cost: { resource: 'initiative', amount: 2 },

    cooldown: 0,
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
    name: 'Kneel',
    icon: 'https://render.guildwars2.com/file/B872B96AC8ED04DE1F1FAE0EA93D71270A6B2DF1/1770631.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_5',
    cost: { resource: 'initiative', amount: 1 },

    // Kneel owns its extra recovery; Core continues to own base initiative policy.
    kneelingInitiativeRegenerationBonus: 1 / 3,
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    cooldown: 0.5,
    castTimeMs: 320,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.kneel' } }]
  },
  [ID.FREE_ACTION]: {
    name: 'Free Action',
    icon: 'https://render.guildwars2.com/file/9DB6B099015F000FE8E9B0F52A245D08E73AA266/1770630.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Rifle',

    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    cooldown: 0,
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
};
