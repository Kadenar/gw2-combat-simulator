/** Core Warrior greatsword packets use nearest-40 ms offsets to remove false timing precision. */
import { COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

export const WARRIOR_WEAPONS_GREATSWORD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<WarriorSkill>>> = {
  [ID.GREATSWORD_SWING]: {
    name: 'Greatsword Swing',
    icon: 'https://render.guildwars2.com/file/DAB93BF5082C34CBF59CBE3820CC6C4AEB4BE7FE/103018.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 400,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.8
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 8
      }
    ])
  },
  [ID.GREATSWORD_SLICE]: {
    name: 'Greatsword Slice',
    icon: 'https://render.guildwars2.com/file/EDA50E3FA2029CE07B5742CECE9557EBBD9DA756/103019.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.05
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 8
      }
    ])
  },
  [ID.BRUTAL_STRIKE]: {
    name: 'Brutal Strike',
    icon: 'https://render.guildwars2.com/file/4D07B5BBA8C206BE9D02B525C13AC9C2D3F93FEB/103020.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 680,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 440, coefficient: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HUNDRED_BLADES]: {
    name: 'Hundred Blades',
    icon: 'https://render.guildwars2.com/file/11BE3E07CBE85E00EF38022658CBFB40DC0F2808/103853.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_2',
    cooldown: 8,
    castTimeMs: 2440,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 320, coefficient: 0.775 },
          { atMs: 480, coefficient: 0.775 },
          { atMs: 680, coefficient: 0.775 },
          { atMs: 880, coefficient: 0.775 },
          { atMs: 1160, coefficient: 0.775 },
          { atMs: 1320, coefficient: 0.775 },
          { atMs: 1560, coefficient: 0.775 },
          { atMs: 1800, coefficient: 0.775 },
          {
            atMs: 2280,
            coefficient: 1.5,
            name: 'Hundred Blades — Final Strike Damage'
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.WHIRLWIND_ATTACK]: {
    name: 'Whirlwind Attack',
    icon: 'https://render.guildwars2.com/file/3D0C289E02A7FD57D40F0A0A2AE352A49E4724C2/103093.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_3',
    cooldown: 10,
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    castTimeMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 0.665,
        hits: 1
      }
    ]
  },
  [ID.BLADETRAIL]: {
    name: 'Bladetrail',
    icon: 'https://render.guildwars2.com/file/7C16111171D29106BF667DED1A7F03B4AA167AD5/103050.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_4',
    cooldown: 15,
    castTimeMs: 560,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 520, coefficient: 1.5 },
          { atMs: 1520, coefficient: 1.5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 1
          }
        ]
      },
      {
        // Both outgoing and returning impacts apply their own one-second immobilize.
        type: 'condition',
        ticks: [
          { atMs: 520, condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 1 },
          { atMs: 1520, condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 1 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.RUSH]: {
    name: 'Rush',
    icon: 'https://render.guildwars2.com/file/6A247111740A3B5C0E2FAF1D3591D105113D0308/103196.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_5',
    cooldown: 20,
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    castTimeMs: 1000,
    // Require Rush to commit before interruption can preserve its strike, keeping the remaining cast lockout.
    interruptCommitMs: 840,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        // The committed charge still lands its strike after the animation is interrupted.
        persistsAfterInterrupt: true,
        coefficient: 2.5,
        hits: 1
      }
    ]
  }
};
