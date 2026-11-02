/** Canonical Core warrior skill definitions grouped by their GW2 owner. */
import { BOON, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

export const WARRIOR_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<WarriorSkill>>> = {
  [ID.CHOP]: {
    name: 'Chop',
    icon: 'https://render.guildwars2.com/file/BDE6BF09D647B6FA9CA0B42A4B4DE8201C5D004F/103144.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 520,
    dualWieldCastTimeMs: 320,
    interruptCommitMs: 440,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 240, coefficient: 0.7 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.DOUBLE_CHOP]: {
    name: 'Double Chop',
    icon: 'https://render.guildwars2.com/file/A0D6F19109A1BBB848D9C7FF1B090C1EAFC01023/103145.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 760,
    dualWieldCastTimeMs: 560,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 240, coefficient: 0.45 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Double Chop — First Chop Damage'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 560, coefficient: 1.05 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Double Chop — Second Chop Damage'
      }
    ]
  },
  [ID.TRIPLE_CHOP]: {
    name: 'Triple Chop',
    icon: 'https://render.guildwars2.com/file/EA1741F12BA0FECD2A0FECB70A2F9E90C749C22C/103146.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 1280,
    dualWieldCastTimeMs: 960,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 280, coefficient: 0.75 },
          { atMs: 600, coefficient: 0.75 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1000, coefficient: 1.6 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Triple Chop — Final chop damage.'
      }
    ]
  },
  [ID.CYCLONE_AXE]: {
    name: 'Cyclone Axe',
    icon: 'https://render.guildwars2.com/file/15ECC799800532F4CEAE170E6D7D03FBA225B7C9/102767.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_2',
    cooldown: 6,
    castTimeMs: 400,
    dualWieldCastTimeMs: 280,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [200, 360].map((atMs) => ({ atMs, coefficient: 0.88 })),
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: COMBO_FINISHER.WHIRL
          }
        ]
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 2,
        stacks: 1,
        applications: 2,
        intervalMs: 160,
        atMs: 200
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 3,
        duration: 8,
        applications: 2,
        intervalMs: 160,
        atMs: 200
      }
    ])
  },
  [ID.THROW_AXE]: {
    name: 'Throw Axe',
    icon: 'https://render.guildwars2.com/file/46C6E91E394242FDD3C762DD672CE01D19C05B67/103247.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_3',
    ammo: 2,

    cooldown: 10,
    ammoCastLockout: 1,
    castTimeMs: 360,
    dualWieldCastTimeMs: 240,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 1
      }
    ],
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // Impact-time health selects the narrowest execute threshold once.
        coefficientModifiers: [
          { kind: 'target-health-below', threshold: 0.25, multiplier: 2 },
          { kind: 'target-health-below', threshold: 0.5, multiplier: 1.5 }
        ],
        coefficient: 0.85,
        projectile: true
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 4
      }
    ])
  },
  [ID.DUAL_STRIKE]: {
    name: 'Dual Strike',
    icon: 'https://render.guildwars2.com/file/20185D064F3665CD7170457DDAC1FBEA0F232974/103000.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_4',
    cooldown: 12,
    // Both strikes and Quickness arrive at the measured impact, before cast recovery.
    dualWieldEffectOffsetsMs: { 400: 280 },
    castTimeMs: 560,
    dualWieldCastTimeMs: 400,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.35,
        hits: 2
      },
      {
        type: 'boon',
        boon: BOON.QUICKNESS,
        duration: 2,
        stacks: 1,
        applications: 2,
        intervalMs: 0
      }
    ])
  },
  [ID.WHIRLING_AXE]: {
    name: 'Whirling Axe',
    icon: 'https://render.guildwars2.com/file/7BD3B56E245B01B50F775627C20965C9410DE842/103866.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_5',
    cooldown: 15,
    castTimeMs: 2720,
    dualWieldCastTimeMs: 2040,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 15 }, (_, index) => ({
          atMs: 320 + index * 160,
          coefficient: 0.5592
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: COMBO_FINISHER.WHIRL
          }
        ]
      }
    ]
  }
};
