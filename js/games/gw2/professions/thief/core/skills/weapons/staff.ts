/** Canonical Core thief skill definitions grouped by their GW2 owner. */
import { ACTOR, COMBO_FINISHER, CONDITION, CONTROL, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ThiefSkill>>> = {
  [ID.HOOK_STRIKE]: {
    name: 'Hook Strike',
    icon: 'https://render.guildwars2.com/file/24CD7E636FADCB6F0CFE07F0B0CA21010FD223E6/1058623.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    cooldown: 1,
    requiredMainHand: WEAPON.STAFF,
    stealthAttack: true,
    castTimeMs: 640,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.65 }],
        name: 'Hook Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.KNOCKDOWN
      }
    ]
  },
  [ID.STAFF_STRIKE]: {
    name: 'Staff Strike',
    icon: 'https://render.guildwars2.com/file/3BBEF12B9DA30A070D6D09B3946E279FC9505407/1058624.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.85 }],
        name: 'Staff Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.STAFF_BASH]: {
    name: 'Staff Bash',
    icon: 'https://render.guildwars2.com/file/BD05C8AE68016991E7611C9407CF4B945BC431DA/1058621.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.9 }],
        name: 'Staff Bash',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PUNISHING_STRIKES]: {
    name: 'Punishing Strikes',
    icon: 'https://render.guildwars2.com/file/0A76E8D24BFC37B724150C071C5ABB44A553806C/1058622.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 760,
    interruptMode: 'per-packet',
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: COMBO_FINISHER.WHIRL
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [160, 320, 520, 680].map((atMs) => ({
          atMs,
          coefficient: 2.1 / 4
        })),
        name: 'Punishing Strikes',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: CONDITION.VULNERABILITY, stacks: 4, duration: 8 }],
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.WEAKENING_WHIRL]: {
    name: 'Weakening Whirl',
    icon: 'https://render.guildwars2.com/file/EDBECD6ACE170F25312C15C3056006FA1170F654/1058625.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_2',
    cost: { resource: 'initiative', amount: 3 },

    cooldown: 0,
    castTimeMs: 720,
    interruptMode: 'per-packet',
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
        ticks: [120, 240, 320].map((atMs) => ({
          atMs,
          coefficient: 2.22 / 3
        })),
        name: 'Weakening Whirl',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        // Each connecting hit adds two seconds of weakness at the strike's timestamp.
        ticks: [120, 240, 320].map((atMs) => ({ atMs, condition: CONDITION.WEAKNESS, stacks: 1, duration: 2 })),
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.DEBILITATING_ARC]: {
    name: 'Debilitating Arc',
    icon: 'https://render.guildwars2.com/file/5AC578E641FC79E9B2F11F43EAF857140F937CF3/1058626.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_3',
    cost: { resource: 'initiative', amount: 3 },

    flipDuration: 3,
    cooldown: 0,
    castTimeMs: 200,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Debilitating Arc',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 6,
        actorType: ACTOR.PLAYER
      }
    ]),
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.HELMET_BREAKER } }]
  },
  [ID.HELMET_BREAKER]: {
    name: 'Helmet Breaker',
    icon: 'https://render.guildwars2.com/file/682C0FBF776E555D24162043AE229FDC915DDD01/3199672.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_3',
    cost: { resource: 'initiative', amount: 1 },

    cooldown: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.25 }],
        name: 'Helmet Breaker',
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
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.HELMET_BREAKER } }]
  },
  [ID.DUST_STRIKE]: {
    name: 'Dust Strike',
    icon: 'https://render.guildwars2.com/file/9F6C490726B9ED26C4CEC20A1825DC9A2C13E5A0/1058628.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_4',
    cost: { resource: 'initiative', amount: 4 },

    cooldown: 0,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [160, 360, 520].map((atMs) => ({
          atMs,
          coefficient: 1.8 / 3
        })),
        name: 'Dust Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 1,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.VAULT]: {
    name: 'Vault',
    icon: 'https://render.guildwars2.com/file/C0BF3D5A0CE30631EF8034597794C053696790EB/1058627.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_5',
    cost: { resource: 'initiative', amount: 5 },

    // The leap is a movement skill for movement-triggered rewards.
    movementSkill: true,
    cooldown: 0,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.25 }],
        name: 'Vault',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  }
};
