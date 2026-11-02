/** Canonical Core engineer skill definitions grouped by their GW2 owner. */
import { ACTOR, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

/** Defines Engineer pistol projectile timing, damage, condition, and combo behavior. */
export const ENGINEER_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.FRAGMENTATION_SHOT]: {
    name: 'Fragmentation Shot',
    icon: 'https://render.guildwars2.com/file/40BE467F4D09226EA70526E4B61C0EDA270B6317/103170.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 520,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 0.2
      }
    ],
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.4,
          hits: 1,
          name: 'Fragmentation Shot',
          interruptCommitMs: 360,
          actorType: ACTOR.PLAYER,
          projectile: true
        },
        {
          type: 'condition',
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 6,
          interruptCommitMs: 360,
          actorType: ACTOR.PLAYER
        }
      ]
    )
  },
  [ID.POISON_DART_VOLLEY]: {
    name: 'Poison Dart Volley',
    icon: 'https://render.guildwars2.com/file/E630EC9663DDE5C165BC0304C636900C7D2006F9/103171.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_2',
    cooldown: 8,
    castTimeMs: 840,
    // Poison Dart Volley is a channel: interruption retains landed darts and cancels only its future packets.
    interruptMode: 'per-packet',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [160, 320, 520, 680, 840].map((atMs) => ({ atMs, coefficient: 2 / 5 })),
        name: 'Poison Dart Volley',
        actorType: ACTOR.PLAYER,
        projectile: true
      },
      {
        type: 'condition',
        ticks: [160, 320, 520, 680, 840].map((atMs) => ({
          atMs,
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 7
        })),
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.STATIC_SHOT]: {
    name: 'Static Shot',
    icon: 'https://render.guildwars2.com/file/CBC5740B8092A6474595F8BFB2394D145D3AB0E8/103406.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_3',
    cooldown: 12,
    castTimeMs: 320,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Static Shot',
        actorType: ACTOR.PLAYER,
        projectile: true
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 3,
        duration: 5,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.BLOWTORCH]: {
    name: 'Blowtorch',
    icon: 'https://render.guildwars2.com/file/061D48DCAC954D91D8F8BD7F6B193201A695F92F/103407.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_4',
    cooldown: 12,
    castTimeMs: 560,
    interruptCommitMs: 360,
    // Committed flame casts keep their remaining lockout before the next player input.
    retainsCastLockoutAfterInterrupt: true,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      // The flame and burning land before aftercast; scheduling at cast end drops committed shortened casts.
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Maximum Damage',
        actorType: ACTOR.PLAYER
      },
      // Each Burning stack is a separate application and can trigger its own relic check.
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 3,
        duration: 4.5,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.GLUE_SHOT]: {
    name: 'Glue Shot',
    icon: 'https://render.guildwars2.com/file/AA05DE91B26C2926046495CE0293966A3C1EA492/103187.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_5',
    cooldown: 20,
    duration: 5,
    castTimeMs: 560,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.BLAST
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Glue Shot',
        actorType: ACTOR.PLAYER,
        projectile: true
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 0, condition: CONDITION.CRIPPLED, stacks: 1, duration: 2 },
          { atMs: 1000, condition: CONDITION.CRIPPLED, stacks: 1, duration: 2 },
          { atMs: 2000, condition: CONDITION.CRIPPLED, stacks: 1, duration: 2 },
          { atMs: 3000, condition: CONDITION.CRIPPLED, stacks: 1, duration: 2 }
        ],
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 1.5,
        actorType: ACTOR.PLAYER
      }
    ]
  }
};
