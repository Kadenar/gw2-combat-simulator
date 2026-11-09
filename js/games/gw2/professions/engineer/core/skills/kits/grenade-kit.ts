/** Core Engineer Grenade Kit skill mechanics. */
import { ACTOR, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';

// Grenade projectiles commit together during the quickened cast, but their serial recovery still occupies the full throw animation after a weapon-kit transition.
const GRENADE_THROW_INTERRUPT_COMMIT_MS = 360;

/** Defines the equip action, palette skills, stow action, and linked toolbelt skill for Grenade Kit. */
export const ENGINEER_GRENADE_KIT_SKILL_MECHANICS: Readonly<Record<string, SkillDefinition<EngineerSkill>>> = {
  [ID.GRENADE_KIT]: {
    name: 'Grenade Kit',
    icon: 'https://render.guildwars2.com/file/C2A603094B5709BE213D391AFD4D33293C19EA38/103396.png',
    type: 'Utility',
    slot: 'Utility',
    // Custom: Equips the kit and updates bundle/weapon state; see `core/mechanics/kits.ts`.
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'equip',
    cooldown: 0,
    castTimeMs: 0,
    effects: [],
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }]
  },
  [ID.GRENADE]: {
    name: 'Grenade',
    icon: 'https://render.guildwars2.com/file/99C41308F9993ED99233525FA009C203E50A6CAF/103423.png',
    type: 'Weapon',
    slot: 'Weapon_1',

    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    kitId: ID.GRENADE_KIT,
    castTimeMs: 680,
    interruptCommitMs: 400,
    retainsCastLockoutAfterInterrupt: true,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 0.2
      }
    ],
    effects: [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        ticks: [
          { atMs: 400, coefficient: 0.33 },
          { atMs: 440, coefficient: 0.33 },
          { atMs: 440, coefficient: 0.33 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        name: 'Grenade',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion',
        projectile: true
      }
    ]
  },
  [ID.SHRAPNEL_GRENADE]: {
    name: 'Shrapnel Grenade',
    icon: 'https://render.guildwars2.com/file/467E6BF83D152F95BC5D0B3573F4D2D71F5A4BFA/102830.png',
    type: 'Weapon',
    slot: 'Weapon_2',

    cooldown: 5,
    kitId: ID.GRENADE_KIT,
    castTimeMs: 680,
    interruptCommitMs: GRENADE_THROW_INTERRUPT_COMMIT_MS,
    retainsCastLockoutAfterInterrupt: true,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        ticks: [400, 440, 440].map((atMs) => ({ atMs, coefficient: 0.63 })),
        name: 'Shrapnel Grenade',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion',
        projectile: true
      },
      {
        type: 'condition',
        ticks: [400, 440, 440].map((atMs) => ({ atMs, condition: CONDITION.BLEEDING, stacks: 1, duration: 7 })),
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.FLASH_GRENADE]: {
    name: 'Flash Grenade',
    icon: 'https://render.guildwars2.com/file/5F7AB3AAB46F21CDBE633A953A4509EAE46C6920/103397.png',
    type: 'Weapon',
    slot: 'Weapon_3',

    cooldown: 10,
    kitId: ID.GRENADE_KIT,
    castTimeMs: 360,
    effects: [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        // Each of the three packets has a 0.1 coefficient; explicit ticks avoid interpreting 0.1 as a split total.
        ticks: [
          { atMs: 120, coefficient: 0.1 },
          { atMs: 240, coefficient: 0.1 },
          { atMs: 360, coefficient: 0.1 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Flash Grenade',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion',
        projectile: true
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.FREEZE_GRENADE]: {
    name: 'Freeze Grenade',
    icon: 'https://render.guildwars2.com/file/D95F525D4F2898CDE205CCACE09FD35FEA78B6DD/103103.png',
    type: 'Weapon',
    slot: 'Weapon_4',

    cooldown: 20,
    kitId: ID.GRENADE_KIT,
    castTimeMs: 680,
    interruptCommitMs: GRENADE_THROW_INTERRUPT_COMMIT_MS,
    retainsCastLockoutAfterInterrupt: true,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        ticks: [400, 440, 440].map((atMs) => ({ atMs, coefficient: 0.75 })),
        name: 'Freeze Grenade',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion',
        projectile: true
      },
      {
        type: 'condition',
        ticks: [400, 440, 440].map((atMs) => ({ atMs, condition: CONDITION.CHILLED, stacks: 1, duration: 2 })),
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.GRENADE_BARRAGE]: {
    name: 'Grenade Barrage',
    icon: 'https://render.guildwars2.com/file/5B2AB667667749BC1BC7AEFD27362E3E0E0F2FE6/103294.png',
    type: 'Profession',
    slot: 'Action',

    cooldown: 25,
    toolbeltParentId: ID.GRENADE_KIT,
    castTimeMs: 680,
    // The supplied condi Holosmith EVTC lands all six impacts during a 560 ms cast.
    interruptCommitMs: 560,
    effects: [
      {
        type: 'strike',
        // Six impacts cluster around 400 to 480 ms in the benchmark, independently of aftercast cancellation.
        ticks: [400, 440, 440, 440, 440, 480].map((atMs) => ({ atMs, coefficient: 3.6 / 6 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Grenade Barrage',
        weapon: 'Profession mechanic',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion'
      }
    ]
  },
  [ID.POISON_GRENADE]: {
    name: 'Poison Grenade',
    icon: 'https://render.guildwars2.com/file/D7236B1D9176DBEEA8C4570AE04965E902B14502/103172.png',
    type: 'Weapon',
    slot: 'Weapon_5',

    cooldown: 20,
    kitId: ID.GRENADE_KIT,
    castTimeMs: 680,
    interruptCommitMs: GRENADE_THROW_INTERRUPT_COMMIT_MS,
    retainsCastLockoutAfterInterrupt: true,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        ticks: [400, 440, 440].map((atMs) => ({ atMs, coefficient: 0.75 })),
        name: 'Poison Grenade',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion',
        projectile: true
      },
      {
        type: 'condition',
        ticks: [400, 440, 440].map((atMs) => ({ atMs, condition: CONDITION.POISONED, stacks: 3, duration: 8 })),
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.STOW_GRENADE_KIT]: {
    name: 'Stow Grenade Kit',
    icon: 'https://render.guildwars2.com/file/7342BF326738A4C5132F42CE0915D3A2184E52FB/60975.png',
    type: 'Utility',
    slot: 'Utility',
    // Custom: Stows the active kit and restores weapon state; see `core/mechanics/kits.ts`.
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'stow',
    paletteFlip: false,
    cooldown: 0,
    kitId: ID.GRENADE_KIT,
    castTimeMs: 0,
    effects: [],
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }]
  }
};
