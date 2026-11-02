/** Canonical Core thief skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill, SkillDefinition } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

// Both Repeater variants fire the same volley; their weapon access, initiative cost, and charge gate are separate.
const REPEATER_ATTACK = {
  castTimeMs: 1000,
  interruptMode: 'per-packet',
  effects: [
    {
      type: 'strike',
      // Three EVTC volleys agree on these rounded impact offsets, including bullets arriving after the channel.
      ticks: [600, 760, 960, 1120, 1280].map((atMs) => ({ atMs, coefficient: 7.5 / 5 })),
      name: 'Repeater',
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
      type: 'condition',
      // Bleeding belongs to each landed projectile rather than a batch granted when the channel ends.
      ticks: [600, 760, 960, 1120, 1280].map((atMs) => ({
        atMs,
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 3
      })),
      actorType: ACTOR.PLAYER,
      timingAnchor: 'castStart',
      timingScale: 'cast'
    }
  ]
} satisfies Pick<Skill, 'castTimeMs' | 'interruptMode' | 'effects'>;

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ThiefSkill>>> = {
  [ID.VITAL_SHOT]: {
    name: 'Vital Shot',
    icon: 'https://render.guildwars2.com/file/DF44613E8041055BFB17D5F0E93C67F23EA4320D/103252.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 360,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.575,
        hits: 1,
        name: 'Vital Shot',
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
        duration: 6,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.SNEAK_ATTACK]: {
    name: 'Sneak Attack',
    icon: 'https://render.guildwars2.com/file/98BEBF73285E355BED016D221EA32D41AFF59F01/104102.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_1',
    cooldown: 1,
    requiredMainHand: WEAPON.PISTOL,
    stealthAttack: true,
    castTimeMs: 680,
    effects: [
      {
        type: 'strike',
        ticks: [120, 280, 400, 560, 680].map((atMs) => ({ atMs, coefficient: 1.8 / 5 })),
        name: 'Sneak Attack',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: CONDITION.BLEEDING, stacks: 5, duration: 5 }],
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.BOLA_SHOT]: {
    name: 'Bola Shot',
    icon: 'https://render.guildwars2.com/file/C203DEA0472BEEA173A60DF41C66F75E7FC0D80A/2261529.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_2',
    cost: { resource: 'initiative', amount: 4 },

    cooldown: 0,
    castTimeMs: 360,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1,
        name: 'Bola Shot',
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
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 3,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 1.5,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.SHADOW_STRIKE]: {
    name: 'Shadow Strike',
    icon: 'https://render.guildwars2.com/file/0E056D0AC615A63656BD4E994756AB1CA9DB13ED/103922.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_3',
    dualWieldAttack: true,
    cost: { resource: 'initiative', amount: 4 },

    // This opener arms its declared dual-wield follow-up.
    dualWieldOpener: true,
    // The retreat shadowsteps away, enabling shared shadowstep rewards such as Peitha.
    shadowstepSkill: true,
    cooldown: 0,
    requiredMainHand: WEAPON.PISTOL,
    requiredOffHand: WEAPON.DAGGER,
    // EVTC records a 160 ms melee segment followed by a 440 ms shot animation: 600 ms on the action grid.
    castTimeMs: 600,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 160, coefficient: 0.315 }],
        name: 'Shadow Strike — Packet 1',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      ...impactEffects({ atMs: 240, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 1.3125,
          hits: 1,
          name: 'Shot Damage',
          actorType: ACTOR.PLAYER,
          comboFinishers: [
            {
              ownerId: 'thief',
              finisherType: COMBO_FINISHER.PROJECTILE
            }
          ]
        }
      ]),
      {
        // The supplied EVTC applies torment with the melee hit, before the retreating shot arrives.
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 4,
        duration: 6,
        actorType: ACTOR.PLAYER,
        atMs: 160,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // PvE grants three Repeater uses sharing a ten-second window; spending a use does not refresh it.
    sideEffects: [
      { on: 'castCommit', do: { type: 'flipArm', skillId: ID.REPEATER_ID_59526, durationSec: 10, uses: 3 } }
    ]
  },
  [ID.REPEATER_ID_59526]: {
    name: 'Repeater',
    icon: 'https://render.guildwars2.com/file/9B4E1B72A86C0F3FCB0B9E272E2A2AEC45669E92/103878.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_3',
    dualWieldAttack: true,
    cost: { resource: 'initiative', amount: 2 },

    cooldown: 0,
    requiredMainHand: WEAPON.PISTOL,
    requiredOffHand: WEAPON.DAGGER,
    ...REPEATER_ATTACK,
    // Activation spends one charge even if interrupted; only depletion or expiry restores Shadow Strike.
    sideEffects: [{ on: 'castStart', do: { type: 'flipConsume', skillId: ID.REPEATER_ID_59526 } }]
  },
  [ID.UNLOAD]: {
    name: 'Unload',
    icon: 'https://render.guildwars2.com/file/BB0B5FF8F7191B0BB39B0C0406EFB52161A6DB47/103129.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_3',
    dualWieldAttack: true,
    cost: { resource: 'initiative', amount: 3 },

    // The channel refund mechanic grants this only after every bullet in the activation lands.
    initiativeRefund: 2,
    cooldown: 0,
    requiredMainHand: WEAPON.PISTOL,
    requiredOffHand: WEAPON.PISTOL,
    castTimeMs: 1320,
    // Interrupting the volley preserves bullets already fired and cancels the remaining packets.
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        // EVTC hit offsets rounded independently to 40 ms keep the observed alternating shot spacing.
        ticks: [240, 400, 480, 640, 720, 880, 960, 1120].map((atMs) => ({
          atMs,
          coefficient: 3.36 / 8
        })),
        name: 'Unload',
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
        duration: 8,
        stacks: 8
      }
    ]
  },
  [ID.REPEATER]: {
    name: 'Repeater',
    icon: 'https://render.guildwars2.com/file/9B4E1B72A86C0F3FCB0B9E272E2A2AEC45669E92/103878.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_3',
    dualWieldAttack: true,
    cost: { resource: 'initiative', amount: 3 },

    cooldown: 0,
    requiredMainHand: WEAPON.PISTOL,
    requiredOffHand: false,
    ...REPEATER_ATTACK
  },
  [ID.HEAD_SHOT]: {
    name: 'Head Shot',
    icon: 'https://render.guildwars2.com/file/01FB72EDB4F0E6B67CE0672B1A960FEBC96FC11A/103119.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_4',
    cost: { resource: 'initiative', amount: 4 },

    cooldown: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: 'Head Shot',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      }
    ]
  },
  [ID.BLACK_POWDER]: {
    name: 'Black Powder',
    icon: 'https://render.guildwars2.com/file/0CE1DF4033D2FA0406E4B8430B270BC99A28D0C2/103236.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_5',
    cost: { resource: 'initiative', amount: 6 },

    cooldown: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [120, 240, 360].map((atMs) => ({ atMs, coefficient: 0.75 / 3 })),
        name: 'Black Powder',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast',
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
        duration: 2,
        actorType: ACTOR.PLAYER,
        applications: 3,
        atMs: 0,
        intervalMs: 2000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
};
