/** Canonical Core thief skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, CONDITION, CONTROL, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ThiefSkill>>> = {
  [ID.SLICE]: {
    name: 'Slice',
    icon: 'https://render.guildwars2.com/file/0524570223F6D37E2A6634E19CEB315135E9560A/104066.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.85 }],
        name: 'Slice (thief skill)',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SLASH]: {
    name: 'Slash',
    icon: 'https://render.guildwars2.com/file/E093DCAAD0F35BB0A2C1369ABB40242A0E42DB70/104096.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 440,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.85 }],
        name: 'Slash (thief skill)',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.CRIPPLING_STRIKE]: {
    name: 'Crippling Strike',
    icon: 'https://render.guildwars2.com/file/6598D9F0150FDF9F77A24CCC060C07C15B7B060D/103168.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 520,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.55,
        hits: 1,
        name: 'Crippling Strike',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.TACTICAL_STRIKE]: {
    name: 'Tactical Strike',
    icon: 'https://render.guildwars2.com/file/D97FB1177ACAC526CF1DE15E0B07F911EBBADD6E/104101.png',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Sword',

    cooldown: 1,
    requiredMainHand: WEAPON.SWORD,
    stealthAttack: true,
    castTimeMs: 360,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 2, hits: 1, name: 'Tactical Strike', actorType: ACTOR.PLAYER },
      { type: 'control', actorType: ACTOR.PLAYER, controlKind: CONTROL.DAZE },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 10, duration: 5, actorType: ACTOR.PLAYER }
    ])
  },
  [ID.INFILTRATORS_STRIKE]: {
    name: "Infiltrator's Strike",
    icon: 'https://render.guildwars2.com/file/2A5C30A8FE579C0169BE3B6FEC05C7E4AFE7FB1D/104067.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_2',
    cost: { resource: 'initiative', amount: 3 },

    flipDuration: 15,
    movementSkill: true,
    cooldown: 0,
    castTimeMs: 0,
    // The strike, immobilize, and independent Swiftness grant all resolve at cast completion.
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: "Infiltrator's Strike",
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 3,
        stacks: 1
      }
    ]),
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.INFILTRATORS_RETURN } }]
  },
  [ID.INFILTRATORS_RETURN]: {
    name: "Infiltrator's Return",
    icon: 'https://render.guildwars2.com/file/4475472B04350267D4DEECECFD53085DA5580D9A/104108.png',
    cost: { resource: 'initiative', amount: 2 },

    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Sword',
    // The return shadowsteps back, so shadowstep and movement rewards (Peitha, Fluid Strikes) apply.
    movementSkill: true,
    shadowstepSkill: true,
    cooldown: 0,
    castTimeMs: 200,
    effects: [],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.INFILTRATORS_RETURN } }]
  },
  [ID.FLANKING_STRIKE]: {
    name: 'Flanking Strike',
    icon: 'https://render.guildwars2.com/file/CEE3C39A075B0363FE04370BDDB0BDDBF8AD0712/103112.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_3',
    dualWieldAttack: true,
    cost: { resource: 'initiative', amount: 4 },

    // This opener arms its declared dual-wield follow-up.
    dualWieldOpener: true,
    cooldown: 0,
    requiredMainHand: WEAPON.SWORD,
    requiredOffHand: WEAPON.DAGGER,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: 'Flanking Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.LARCENOUS_STRIKE, durationSec: 4 } }]
  },
  [ID.LARCENOUS_STRIKE]: {
    name: 'Larcenous Strike',
    icon: 'https://render.guildwars2.com/file/01E5F13EA2E13B0A01540BFF9837299FEF20CF2C/575653.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_3',
    dualWieldAttack: true,
    cost: { resource: 'initiative', amount: 1 },

    cooldown: 0,
    requiredMainHand: WEAPON.SWORD,
    requiredOffHand: WEAPON.DAGGER,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.17 }],
        name: 'Larcenous Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    // Apply the intrinsic factor to the current packet, retaining coefficient patch semantics.
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, _cast, effects) =>
          effects.map((effect) =>
            effect.type !== 'strike'
              ? effect
              : effect.ticks?.length
                ? { ...effect, ticks: effect.ticks.map((tick) => ({ ...tick, coefficient: tick.coefficient * 1.2 })) }
                : { ...effect, coefficient: (effect.coefficient || 0) * 1.2 }
          )
      }
    ],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.LARCENOUS_STRIKE } }]
  },
  [ID.STAB]: {
    name: 'Stab',
    icon: 'https://render.guildwars2.com/file/6FF6A961A44C091A4E0347D52CCFC2711B0DDC57/104100.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_3',
    dualWieldAttack: true,
    cost: { resource: 'initiative', amount: 4 },

    cooldown: 0,
    requiredMainHand: WEAPON.SWORD,
    requiredOffHand: false,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.05 }],
        name: 'Stab (thief sword skill)',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.FLAWLESS_EXECUTION]: {
    dualWieldAttack: true,
    name: 'Flawless Execution',
    icon: 'https://render.guildwars2.com/file/699690FE99AEF7BABBF4789800EC31CCC74C78AC/3790491.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_3',
    cost: { resource: 'initiative', amount: 4 },

    cooldown: 0,
    requiredMainHand: WEAPON.SWORD,
    requiredOffHand: WEAPON.PISTOL,
    castTimeMs: 1400,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 400, coefficient: 0.53 },
          { atMs: 560, coefficient: 0.53 },
          { atMs: 720, coefficient: 0.53 }
        ],
        name: 'Flawless Execution — Packet 1',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1240, coefficient: 1.6 }],
        name: 'Final Slash Damage',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          { atMs: 320, coefficient: 0.25 },
          { atMs: 440, coefficient: 0.25 },
          { atMs: 520, coefficient: 0.25 },
          { atMs: 640, coefficient: 0.25 },
          { atMs: 760, coefficient: 0.25 },
          { atMs: 840, coefficient: 0.25 }
        ],
        name: 'Projectile Damage',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  }
};
