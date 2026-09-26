/** Core Engineer Grenade Kit skill mechanics. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// Grenade projectiles commit together during the quickened cast, but their serial recovery still occupies the full throw animation after a weapon-kit transition.
const GRENADE_THROW_INTERRUPT_COMMIT_MS = 360;

/** Defines the equip action, palette skills, stow action, and linked toolbelt skill for Grenade Kit. */
export const ENGINEER_GRENADE_KIT_SKILL_MECHANICS: Readonly<Record<string, Partial<Skill>>> = Object.freeze({
  [ID.GRENADE_KIT]: {
    // Custom: Equips the kit and updates bundle/weapon state; see `core/mechanics/kits.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'equip',
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kitName: 'Grenade Kit'
  },
  [ID.POISON_GRENADE]: {
    castTimeMs: 680,
    cooldown: 20,
    interruptCommitMs: GRENADE_THROW_INTERRUPT_COMMIT_MS,
    retainsCastLockoutAfterInterrupt: true,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [400, 440, 440].map((atMs) => ({ atMs, coefficient: 0.75 })),
        name: 'Poison Grenade',
        actorType: 'player',
        damageKind: 'explosion',
        projectile: true
      },
      {
        type: 'condition',
        ticks: [400, 440, 440].map((atMs) => ({ atMs, condition: 'Poisoned', stacks: 3, duration: 8 })),
        actorType: 'player'
      }
    ]),
    kit: 'Grenade Kit'
  },
  [ID.SHRAPNEL_GRENADE]: {
    castTimeMs: 680,
    cooldown: 5,
    interruptCommitMs: GRENADE_THROW_INTERRUPT_COMMIT_MS,
    retainsCastLockoutAfterInterrupt: true,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [400, 440, 440].map((atMs) => ({ atMs, coefficient: 0.63 })),
        name: 'Shrapnel Grenade',
        actorType: 'player',
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        ticks: [400, 440, 440].map((atMs) => ({ atMs, condition: 'Bleeding', stacks: 1, duration: 7 })),
        actorType: 'player'
      }
    ]),
    kit: 'Grenade Kit'
  },
  [ID.FLASH_GRENADE]: {
    castTimeMs: 360,
    cooldown: 10,
    effects: [
      {
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
        actorType: 'player',
        damageKind: 'explosion'
      },
      {
        type: 'blind',
        actorType: 'player',
        duration: 5
      }
    ],
    kit: 'Grenade Kit'
  },
  [ID.FREEZE_GRENADE]: {
    castTimeMs: 680,
    cooldown: 20,
    interruptCommitMs: GRENADE_THROW_INTERRUPT_COMMIT_MS,
    retainsCastLockoutAfterInterrupt: true,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [400, 440, 440].map((atMs) => ({ atMs, coefficient: 0.75 })),
        name: 'Freeze Grenade',
        actorType: 'player',
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        ticks: [400, 440, 440].map((atMs) => ({ atMs, condition: 'Chilled', stacks: 1, duration: 2 })),
        actorType: 'player'
      }
    ]),
    kit: 'Grenade Kit'
  },
  [ID.GRENADE_BARRAGE]: {
    castTimeMs: 680,
    // The supplied condi Holosmith EVTC lands all six impacts during a 560 ms cast.
    interruptCommitMs: 560,
    cooldown: 25,
    effects: [
      {
        type: 'strike',
        // Six impacts cluster around 400–480 ms in the benchmark, independently of aftercast cancellation.
        ticks: [400, 440, 440, 440, 440, 480].map((atMs) => ({ atMs, coefficient: 3.6 / 6 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Grenade Barrage',
        weapon: 'Profession mechanic',
        actorType: 'player',
        damageKind: 'explosion'
      }
    ],
    toolbeltParentName: 'Grenade Kit'
  },
  [ID.GRENADE]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 680,
    cooldown: 0,
    interruptCommitMs: GRENADE_THROW_INTERRUPT_COMMIT_MS,
    retainsCastLockoutAfterInterrupt: true,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Projectile',
        chance: 0.2,
        preferredFieldTypes: ['Fire'],
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
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
        actorType: 'player',
        damageKind: 'explosion'
      }
    ],
    kit: 'Grenade Kit'
  },
  [ID.STOW_GRENADE_KIT]: {
    // Custom: Stows the active kit and restores weapon state; see `core/mechanics/kits.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'stow',
    paletteFlip: false,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kit: 'Grenade Kit'
  }
});
