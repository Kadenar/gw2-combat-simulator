/** Canonical Core thief skill definitions grouped by their GW2 owner. */
import { ACTOR, COMBO_FINISHER, CONDITION, CONTROL, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_SHORTBOW_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ThiefSkill>>> = {
  [ID.TRICK_SHOT]: {
    name: 'Trick Shot',
    icon: 'https://render.guildwars2.com/file/714625F60FDF0850FAA644B641D90867C1D37B74/103561.png',
    type: 'Weapon',
    weapon: 'Shortbow',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 360,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.55,
        hits: 1,
        name: 'Trick Shot',
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
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.SURPRISE_SHOT]: {
    name: 'Surprise Shot',
    icon: 'https://render.guildwars2.com/file/732FBB350FE66CD97A0F4E1A38214B413D0EA3CA/103618.png',
    type: 'Weapon',
    weapon: 'Shortbow',
    slot: 'Weapon_1',
    cooldown: 1,
    requiredMainHand: WEAPON.SHORTBOW,
    stealthAttack: true,
    castTimeMs: 200,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        name: 'Surprise Shot',
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
        condition: CONDITION.BLEEDING,
        stacks: 3,
        duration: 5,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.CLUSTER_BOMB]: {
    name: 'Cluster Bomb',
    icon: 'https://render.guildwars2.com/file/A0B95CCA2D42FA9E6D59930B0BF9122031C5E153/104074.png',
    type: 'Weapon',
    weapon: 'Shortbow',
    slot: 'Weapon_2',
    cost: { resource: 'initiative', amount: 3 },

    flipDuration: 1,
    cooldown: 0,
    castTimeMs: 360,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        name: 'Large Explosion',
        actorType: ACTOR.PLAYER,
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER
      }
    ]),
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.DETONATE_CLUSTER } }]
  },
  [ID.DETONATE_CLUSTER]: {
    name: 'Detonate Cluster',
    icon: 'https://render.guildwars2.com/file/4C047ECABFFD7DC2D40E76734B552DED1BCC19BE/104075.png',
    type: 'Weapon',
    weapon: 'Shortbow',
    slot: 'Weapon_2',
    cooldown: 0,
    castTimeMs: 680,
    effects: [
      {
        type: 'strike',
        ticks: [160, 360, 520, 680].map((atMs) => ({ atMs, coefficient: 2 / 4 })),
        name: 'Small Explosion',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: CONDITION.BLEEDING, stacks: 1, duration: 4 }],
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.DETONATE_CLUSTER } }]
  },
  [ID.DISABLING_SHOT]: {
    name: 'Disabling Shot',
    icon: 'https://render.guildwars2.com/file/96DBA91D4F719ED32F65B0E7AE1F01AD63C2FC02/104094.png',
    type: 'Weapon',
    weapon: 'Shortbow',
    slot: 'Weapon_3',
    cost: { resource: 'initiative', amount: 4 },

    // The backward leap is a movement skill for movement-triggered rewards.
    movementSkill: true,
    cooldown: 0,
    castTimeMs: 200,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Disabling Shot (thief short bow skill)',
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
        duration: 2,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.CHOKING_GAS]: {
    name: 'Choking Gas',
    icon: 'https://render.guildwars2.com/file/EB3BACBB2F3B7C67CB14076964EDB13CA85174E2/103540.png',
    type: 'Weapon',
    weapon: 'Shortbow',
    slot: 'Weapon_4',
    cost: { resource: 'initiative', amount: 4 },

    cooldown: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [80, 200, 280, 360].map((atMs) => ({ atMs, coefficient: 2.4 / 4 })),
        name: 'Choking Gas',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: CONDITION.POISONED, stacks: 1, duration: 3 }],
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
  [ID.INFILTRATORS_ARROW]: {
    name: "Infiltrator's Arrow",
    icon: 'https://render.guildwars2.com/file/1C076C7774EA3FDCA7BB473D0FB6A50A685A5A28/103890.png',
    type: 'Weapon',
    weapon: 'Shortbow',
    slot: 'Weapon_5',
    cost: { resource: 'initiative', amount: 6 },

    // The arrow shadowsteps the thief, so shadowstep and movement rewards (Peitha, Fluid Strikes) apply.
    movementSkill: true,
    shadowstepSkill: true,
    cooldown: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ]
  }
};
