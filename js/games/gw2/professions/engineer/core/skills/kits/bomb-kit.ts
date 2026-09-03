/** Core Engineer Bomb Kit skill mechanics. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Defines the equip action, palette skills, stow action, and linked toolbelt skill for Bomb Kit. */
export const ENGINEER_BOMB_KIT_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  [ID.BOMB_KIT]: {
    // Custom: Equips the kit and updates bundle/weapon state; see `core/mechanics/kits.ts`.
    handlerId: 'engineer.kit-equip',
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kitName: 'Bomb Kit'
  },
  [ID.BIG_OL_BOMB]: {
    interruptCommitMs: 0,
    quicknessCastTimeMs: 600,
    cooldown: 20,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Blast',
        successfulCombos: 2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 2760, coefficient: 3 }],
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: "Big Ol' Bomb",
        actorType: 'player',
        persistsAfterInterrupt: true,
        damageKind: 'explosion'
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 2760,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        controlKind: 'knockdown',
        duration: 3
      }
    ],
    kit: 'Bomb Kit'
  },
  [ID.GALVANIC_BOMB]: {
    interruptCommitMs: 0,
    quicknessCastTimeMs: 600,
    cooldown: 16,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 760, coefficient: 2.5 }],
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Galvanic Bomb',
        actorType: 'player',
        persistsAfterInterrupt: true,
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 760, condition: 'Confusion', stacks: 6, duration: 8 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 760,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        controlKind: 'daze',
        duration: 1
      }
    ],
    kit: 'Bomb Kit'
  },
  [ID.FIRE_BOMB]: {
    quicknessCastTimeMs: 600,
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
    interruptCommitMs: 0,
    castTimeMs: 500,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 1000, coefficient: 1.2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Bomb',
        actorType: 'player',
        persistsAfterInterrupt: true,
        damageKind: 'explosion'
      }
    ],
    kit: 'Bomb Kit'
  },
  [ID.STOW_BOMB_KIT]: {
    // Custom: Stows the active kit and restores weapon state; see `core/mechanics/kits.ts`.
    handlerId: 'engineer.kit-stow',
    paletteFlip: false,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kit: 'Bomb Kit'
  },
  [ID.MAGNETIC_BOMB]: {
    interruptCommitMs: 0,
    quicknessCastTimeMs: 600,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 1760, coefficient: 1.5 }],
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Magnetic Bomb',
        actorType: 'player',
        persistsAfterInterrupt: true,
        damageKind: 'explosion'
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 1760,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        controlKind: 'pull',
        duration: 300
      }
    ],
    kit: 'Bomb Kit'
  }
});
