/** Core Engineer Bomb Kit skill mechanics. */
import { ENGINEER_SKILL_IDS as ID } from '../../data/ids.js';
import type { SkillFragment } from '../../../../../platform/engine/types.js';

// Owns the equip action, palette skills, stow action, and linked toolbelt skill for Bomb Kit.
export const ENGINEER_BOMB_KIT_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  [ID.BOMB_KIT]: {
    implemented: true,
    handlerId: 'engineer.kit-equip',
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kitName: 'Bomb Kit'
  },
  [ID.BIG_OL_BOMB]: {
    interruptCommitMs: 0,
    implemented: true,
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
        coefficient: 3,
        hits: 1,
        atMs: 2760,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: "Big Ol' Bomb",
        actorType: 'player',
        persistsAfterInterrupt: true,
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 2760,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {
          controlKind: 'knockdown',
          duration: 3
        }
      }
    ],
    kit: 'Bomb Kit'
  },
  [ID.GALVANIC_BOMB]: {
    interruptCommitMs: 0,
    implemented: true,
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
        coefficient: 2.5,
        hits: 1,
        atMs: 760,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Galvanic Bomb',
        actorType: 'player',
        persistsAfterInterrupt: true,
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 6,
        duration: 8,
        actorType: 'player',
        atMs: 760,
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
        metadata: {
          controlKind: 'daze',
          duration: 1
        }
      }
    ],
    kit: 'Bomb Kit'
  },
  [ID.FIRE_BOMB]: {
    implemented: true,
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
        coefficient: 1,
        hits: 4,
        atMs: 760,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Fire Bomb',
        actorType: 'player',
        persistsAfterInterrupt: true,
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 2,
        duration: 5,
        actorType: 'player',
        atMs: 760,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 2,
        applications: 3,
        atMs: 1760,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player',
        persistsAfterInterrupt: true
      }
    ],
    kit: 'Bomb Kit'
  },
  [ID.SMOKE_BOMB_ENGINEER_SKILL]: {
    implemented: true,
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
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        atMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Bomb',
        actorType: 'player',
        persistsAfterInterrupt: true,
        metadata: {
          damageKind: 'explosion'
        }
      }
    ],
    kit: 'Bomb Kit'
  },
  [ID.STOW_BOMB_KIT]: {
    implemented: true,
    handlerId: 'engineer.kit-stow',
    paletteFlip: false,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kit: 'Bomb Kit'
  },
  [ID.MAGNETIC_BOMB]: {
    interruptCommitMs: 0,
    implemented: true,
    quicknessCastTimeMs: 600,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        atMs: 1760,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Magnetic Bomb',
        actorType: 'player',
        persistsAfterInterrupt: true,
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 1760,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {
          controlKind: 'pull',
          duration: 300
        }
      }
    ],
    kit: 'Bomb Kit'
  }
});
