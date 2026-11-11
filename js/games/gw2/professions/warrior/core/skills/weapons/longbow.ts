/** Canonical Core warrior skill definitions grouped by their GW2 owner. */
import { COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

export const WARRIOR_WEAPONS_LONGBOW_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.DUAL_SHOT]: {
    name: 'Dual Shot',
    icon: 'https://render.guildwars2.com/file/F51C183650406C033D965D97D4BA370762AC2F03/103082.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 840,
    interruptMode: 'commit',
    // Preserve committed arrows and hold the cast lane through the remaining animation.
    interruptCommitMs: 720,
    retainsCastLockoutAfterInterrupt: true,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 0.2
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 560, coefficient: 0.525 },
          { atMs: 600, coefficient: 0.525 }
        ],
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.FAN_OF_FIRE]: {
    name: 'Fan of Fire',
    icon: 'https://render.guildwars2.com/file/BF057D09F65B0B11FA11767774715D4209E13869/104141.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_2',
    cooldown: 5,
    castTimeMs: 560,
    // The arrows commit at 240 ms, but canceling after release retains the
    // remaining animation as aftercast for ordinary cast-time skills.
    interruptCommitMs: 240,
    retainsCastLockoutAfterInterrupt: true,
    // The first arrow carries the stronger payload; both additional arrows hit the same simulated target.
    effects: impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        name: 'First hit',
        coefficient: 0.88
      },
      {
        type: 'strike',
        name: 'Additional hits',
        coefficient: 0.44,
        hits: 2
      },
      {
        type: 'condition',
        name: 'First hit burning',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 5
      },
      {
        type: 'condition',
        name: 'Additional hit burning',
        condition: CONDITION.BURNING,
        stacks: 2,
        duration: 2
      }
    ])
  },
  [ID.ARCING_ARROW]: {
    name: 'Arcing Arrow',
    icon: 'https://render.guildwars2.com/file/2557F1F1BC385EC9685C7409A77902AC7BFFFBF0/104114.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_3',
    cooldown: 8,
    ammoCastLockout: 1,
    ammo: 2,

    castTimeMs: 560,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.BLAST
      }
    ],
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.5,
        // The impact is an explosion so explosion-triggered Bladesworn effects can observe it.
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 5
      }
    ])
  },
  [ID.SMOLDERING_ARROW]: {
    name: 'Smoldering Arrow',
    icon: 'https://render.guildwars2.com/file/AD57051DA007DE23FF0F400820C2DA700C064E96/102783.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_4',
    cooldown: 16,
    ammo: 3,

    ammoCastLockout: 0.5,
    castTimeMs: 160,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.PROJECTILE
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        // The impact is an explosion so explosion-triggered Bladesworn effects can observe it.
        damageKind: 'explosion'
      },
      {
        // Store the base duration so equipped Expertise extends Burning once.
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 3
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      }
    ]
  },
  [ID.PIN_DOWN]: {
    name: 'Pin Down',
    icon: 'https://render.guildwars2.com/file/7DE4320F3647753F9B3DD1EC4CF972ABADFF93CE/103213.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_5',
    cooldown: 20,
    castTimeMs: 680,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.PROJECTILE
      }
    ],
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.44,
        // Only a landed arrow restores Fan of Fire; misses cannot clear its recharge.
        reactions: [
          {
            on: 'damage.resolved',
            actor: 'player',
            packets: 'first',
            do: [{ type: 'rechargeReset', skillIds: [ID.FAN_OF_FIRE] }]
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 6,
        duration: 12
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 3
      }
    ])
  }
};
