/** Core Engineer Bomb Kit skill mechanics. */
import { ACTOR, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Defines the equip action, palette skills, stow action, and linked toolbelt skill for Bomb Kit. */
export const ENGINEER_BOMB_KIT_SKILL_MECHANICS: Readonly<Record<string, SkillDefinition<EngineerSkill>>> = {
  [ID.BOMB_KIT]: {
    name: 'Bomb Kit',
    icon: 'https://render.guildwars2.com/file/B06C59BBB1EC416859E04E7C9859BE020C4B3E17/103399.png',
    type: 'Utility',
    slot: 'Utility',
    // Custom: Equips the kit and updates bundle/weapon state; see `core/hooks.ts`.
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'equip',
    cooldown: 0,
    castTimeMs: 0,
    effects: [],
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }]
  },
  [ID.BOMB]: {
    name: 'Bomb',
    icon: 'https://render.guildwars2.com/file/02A02091B1EBDB782719EB6AE56F01E6372C500D/103091.png',
    type: 'Weapon',
    slot: 'Weapon_1',

    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    kitId: ID.BOMB_KIT,
    castTimeMs: 600,
    // Once placement commits at 440 ms, retain the full cast lockout and delayed explosion.
    interruptCommitMs: 440,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        ticks: [{ atMs: 1360, coefficient: 1.2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        name: 'Bomb',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion'
      }
    ]
  },
  [ID.FIRE_BOMB]: {
    name: 'Fire Bomb',
    icon: 'https://render.guildwars2.com/file/95DF02395BB2C2EFD4D7BA5BE3ECC512E875EFEE/103404.png',
    type: 'Weapon',
    slot: 'Weapon_2',

    cooldown: 8,
    kitId: ID.BOMB_KIT,
    castTimeMs: 600,
    interruptCommitMs: 400,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: COMBO_FIELD.FIRE,
        duration: 3,
        startAnchor: 'castEnd',
        inclusiveExpiry: true
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        // Regular field pulses use the shared repetition contract; each pulse owns its coefficient.
        atMs: 760,
        coefficient: 1 / 4,
        applications: 4,
        intervalMs: 1000,
        name: 'Fire Bomb',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 760, condition: CONDITION.BURNING, stacks: 2, duration: 5 }],
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        atMs: 1760,
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 2,
        applications: 3,
        intervalMs: 1000,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.GALVANIC_BOMB]: {
    name: 'Galvanic Bomb',
    icon: 'https://render.guildwars2.com/file/E406DB5F73E8AE312E0E04650FDAF0CCFCFC28FF/103403.png',
    type: 'Weapon',
    slot: 'Weapon_3',

    cooldown: 16,
    kitId: ID.BOMB_KIT,
    castTimeMs: 600,
    // Once placement commits at 480 ms, retain the full cast lockout and delayed explosion, confusion, and daze.
    interruptCommitMs: 480,
    retainsCastLockoutAfterInterrupt: true,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.BLAST
      }
    ],
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 760, timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Galvanic Bomb',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 6,
        duration: 8,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.DAZE
      }
    ])
  },
  [ID.SMOKE_BOMB_ENGINEER_SKILL]: {
    name: 'Smoke Bomb (engineer skill)',
    icon: 'https://render.guildwars2.com/file/2D0B6AC204047FE40504BFD7B0B1E015FEF75C2F/103405.png',
    type: 'Profession',
    slot: 'Action',

    cooldown: 20,
    toolbeltParentId: ID.BOMB_KIT,
    castTimeMs: 0,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.MAGNETIC_BOMB]: {
    name: 'Magnetic Bomb',
    icon: 'https://render.guildwars2.com/file/B70B5426F0B2F4924E08198069789121426F9517/103176.png',
    type: 'Weapon',
    slot: 'Weapon_4',

    cooldown: 20,
    kitId: ID.BOMB_KIT,
    castTimeMs: 600,
    // Once placement commits at 440 ms, retain the full cast lockout and delayed explosion and pull.
    interruptCommitMs: 440,
    retainsCastLockoutAfterInterrupt: true,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 1760, timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          weaponStrengthProfileId: 'bundle.ascended',
          type: 'strike',
          coefficient: 1.5,
          hits: 1,
          name: 'Magnetic Bomb',
          actorType: ACTOR.PLAYER,
          damageKind: 'explosion'
        },
        {
          type: 'control',
          actorType: ACTOR.PLAYER,
          controlKind: CONTROL.PULL
        }
      ]
    )
  },
  [ID.STOW_BOMB_KIT]: {
    name: 'Stow Bomb Kit',
    icon: 'https://render.guildwars2.com/file/7342BF326738A4C5132F42CE0915D3A2184E52FB/60975.png',
    type: 'Utility',
    slot: 'Utility',
    // Custom: Stows the active kit and restores weapon state; see `core/hooks.ts`.
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'stow',
    paletteFlip: false,
    cooldown: 0,
    kitId: ID.BOMB_KIT,
    castTimeMs: 0,
    effects: [],
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }]
  },
  [ID.BIG_OL_BOMB]: {
    name: "Big Ol' Bomb",
    icon: 'https://render.guildwars2.com/file/9ADBE10F0E4F7D75DC0BF54EBD5B360BE1AB9D09/103400.png',
    type: 'Weapon',
    slot: 'Weapon_5',

    cooldown: 20,
    kitId: ID.BOMB_KIT,
    castTimeMs: 600,
    // Placement commits at 480 ms; the persistent explosion and knockdown keep their original detonation time.
    interruptCommitMs: 480,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.BLAST,
        successfulCombos: 2
      }
    ],
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 2760, timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          weaponStrengthProfileId: 'bundle.ascended',
          type: 'strike',
          coefficient: 3,
          hits: 1,
          name: "Big Ol' Bomb",
          actorType: ACTOR.PLAYER,
          damageKind: 'explosion'
        },
        {
          type: 'control',
          actorType: ACTOR.PLAYER,
          controlKind: CONTROL.KNOCKDOWN
        }
      ]
    )
  }
};
