/** Core Engineer Bomb Kit skill mechanics. */
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/** Defines the equip action, palette skills, stow action, and linked toolbelt skill for Bomb Kit. */
export const ENGINEER_BOMB_KIT_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  [ID.BOMB_KIT]: {
    // Custom: Equips the kit and updates bundle/weapon state; see `core/mechanics/kits.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    handlerId: 'engineer.kit-equip',
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kitName: 'Bomb Kit'
  },
  [ID.BIG_OL_BOMB]: {
    // The placed bomb commits after 520 ms, so its delayed explosion and knockdown survive later interruption.
    interruptCommitMs: 520,
    castTimeMs: 600,
    cooldown: 20,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Blast',
        successfulCombos: 2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 2760, timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 3,
          hits: 1,
          name: "Big Ol' Bomb",
          actorType: 'player',
          damageKind: 'explosion'
        },
        {
          type: 'control',
          actorType: 'player',
          controlKind: 'knockdown'
        }
      ]
    ),
    kit: 'Bomb Kit'
  },
  [ID.GALVANIC_BOMB]: {
    // Once placement commits at 520 ms, retain the full cast lockout and delayed explosion, confusion, and daze.
    interruptCommitMs: 520,
    retainsCastLockoutAfterInterrupt: true,
    castTimeMs: 600,
    cooldown: 16,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 760, timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Galvanic Bomb',
        actorType: 'player',
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 6,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'daze'
      }
    ]),
    kit: 'Bomb Kit'
  },
  [ID.FIRE_BOMB]: {
    castTimeMs: 600,
    interruptCommitMs: 400,
    cooldown: 8,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: 'Fire',
        duration: 3,
        startAnchor: 'castEnd',
        inclusiveExpiry: true
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 4 }, (_, index) => ({ atMs: 760 + index * 1000, coefficient: 1 / 4 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Fire Bomb',
        actorType: 'player',
        persistsAfterInterrupt: true,
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 760, condition: 'Burning', stacks: 2, duration: 5 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 3 }, (_, index) => ({
          atMs: 1760 + index * 1000,
          condition: 'Burning',
          stacks: 1,
          duration: 2
        })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player',
        persistsAfterInterrupt: true
      }
    ],
    kit: 'Bomb Kit'
  },
  [ID.SMOKE_BOMB_ENGINEER_SKILL]: {
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'blind',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Bomb Kit'
  },
  [ID.BOMB]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 360,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 1000, coefficient: 1.2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Bomb',
        actorType: 'player',
        damageKind: 'explosion'
      }
    ],
    kit: 'Bomb Kit'
  },
  [ID.STOW_BOMB_KIT]: {
    // Custom: Stows the active kit and restores weapon state; see `core/mechanics/kits.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    handlerId: 'engineer.kit-stow',
    paletteFlip: false,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kit: 'Bomb Kit'
  },
  [ID.MAGNETIC_BOMB]: {
    // Once placement commits at 440 ms, retain the full cast lockout and delayed explosion and pull.
    interruptCommitMs: 440,
    retainsCastLockoutAfterInterrupt: true,
    castTimeMs: 600,
    cooldown: 20,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 1760, timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 1.5,
          hits: 1,
          name: 'Magnetic Bomb',
          actorType: 'player',
          damageKind: 'explosion'
        },
        {
          type: 'control',
          actorType: 'player',
          controlKind: 'pull'
        }
      ]
    ),
    kit: 'Bomb Kit'
  }
});
