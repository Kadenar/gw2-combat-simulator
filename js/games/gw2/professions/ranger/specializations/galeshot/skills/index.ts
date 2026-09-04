/** Explicit PvE skill mechanics owned by the Galeshot Ranger module. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Cyclone Bow entry and exit are state-selected variants of one F5 UI tile.
const CYCLONE_BOW_PALETTE_TILE = 'galeshot-cyclone-bow';
// Keen Shot flips to Hawkeye at full Wind Force without creating a second weapon tile.
const CYCLONE_BOW_ONE_PALETTE_TILE = 'galeshot-cyclone-bow-one';

export const GALESHOT_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.WHIRLWIND]: {
    evades: true,
    effects: [],
    quicknessCastTimeMs: 500
  },
  [ID.MISTRAL]: {
    quicknessCastTimeMs: 320,
    effects: [],
    arrowsRestored: 1,
    // Custom: Restores arrows and opens the Mistral buff window; see `galeshot/execution/index.ts`.
    handlerId: 'ranger.mistral'
  },
  [ID.SUMMON_CYCLONE_BOW]: {
    castTimeMs: 0,
    paletteTileId: CYCLONE_BOW_PALETTE_TILE,
    paletteTileOrder: 1,
    effects: [],
    // Custom: Equips Cyclone Bow, resets chains, and emits weapon-swap/state events; see `galeshot/execution/index.ts`.
    handlerId: 'ranger.cyclone-bow-enter'
  },
  [ID.PERFECT_STORM]: {
    interruptCommitMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Perfect Storm - Traveling Tornado Damage'
      },
      {
        type: 'strike',
        ticks: [680, 1200, 1720, 2240, 2760, 3280, 3800, 4320, 4840, 5360, 5880, 6400].map((atMs) => ({
          atMs,
          coefficient: 0.7
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        name: 'Perfect Storm - Stationary Tornado Damage'
      },
      {
        type: 'control',
        atMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        controlKind: 'launch'
      }
    ],
    quicknessCastTimeMs: 600,
    arrowsRestored: 2,
    // Custom: Restores Cyclone Bow arrows and emits state; see `galeshot/execution/index.ts`.
    handlerId: 'ranger.galeshot-arrows'
  },
  [ID.WIND_SHEAR]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 3,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 333
  },
  [ID.DISMISS_CYCLONE_BOW]: {
    castTimeMs: 0,
    paletteTileId: CYCLONE_BOW_PALETTE_TILE,
    paletteTileOrder: 2,
    effects: [],
    // Custom: Stows Cyclone Bow, clears Wind Force, and emits weapon-swap/state events; see `galeshot/execution/index.ts`.
    handlerId: 'ranger.cyclone-bow-exit'
  },
  [ID.PIERCING_GALES]: {
    effects: [
      {
        type: 'strike',
        ticks: [480, 480, 520, 520, 600].map((atMs) => ({
          atMs,
          coefficient: 0.7
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 6
      }
    ],
    quicknessCastTimeMs: 640,
    arrowsRestored: 1,
    // Custom: Restores Cyclone Bow arrows and emits state; see `galeshot/execution/index.ts`.
    handlerId: 'ranger.galeshot-arrows',
    missileHits: 5
  },
  [ID.SOOTHING_BREEZE]: {
    effects: [],
    quicknessCastTimeMs: 500
  },
  [ID.KEEN_SHOT]: {
    paletteTileId: CYCLONE_BOW_ONE_PALETTE_TILE,
    paletteTileOrder: 1,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 0.75 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    arrowCost: 0,
    quicknessCastTimeMs: 480
  },
  [ID.HAWKEYE]: {
    paletteTileId: CYCLONE_BOW_ONE_PALETTE_TILE,
    paletteTileOrder: 2,
    interruptCommitMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [800, 920, 1040, 1160, 1280].map((atMs) => ({
          atMs,
          coefficient: 1.36
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ],
    arrowCost: 0,
    // Custom: Spends arrows, updates Wind Force, and applies Cyclone Bow traits; see `galeshot/execution/index.ts`.
    handlerId: 'ranger.cyclone-bow-skill',
    quicknessCastTimeMs: 880
  },
  [ID.BLUSTER]: {
    effects: [
      {
        type: 'strike',
        ticks: [520, 600, 640].map((atMs) => ({
          atMs,
          coefficient: 0.64
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    arrowCost: 1,
    // Custom: Spends arrows, updates Wind Force, and applies Cyclone Bow traits; see `galeshot/execution/index.ts`.
    handlerId: 'ranger.cyclone-bow-skill',
    quicknessCastTimeMs: 680,
    windForceGain: 1,
    windForceApplyMs: 480
  },
  [ID.FLEETING_ZEPHYR]: {
    evades: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 0.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ],
    arrowCost: 1,
    // Custom: Spends arrows, updates Wind Force, and applies Cyclone Bow traits; see `galeshot/execution/index.ts`.
    handlerId: 'ranger.cyclone-bow-skill',
    quicknessCastTimeMs: 520,
    windForceGain: 1,
    windForceApplyMs: 240
  },
  [ID.QUARRYS_PERIL]: {
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 800, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2
      }
    ],
    arrowCost: 2,
    // Custom: Spends arrows, updates Wind Force, and applies Cyclone Bow traits; see `galeshot/execution/index.ts`.
    handlerId: 'ranger.cyclone-bow-skill',
    quicknessCastTimeMs: 680,
    interruptCommitMs: 320,
    retainsCastLockoutAfterInterrupt: true,
    windForceGain: 1,
    windForceApplyMs: 280
  },
  [ID.PELT]: {
    interruptCommitMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 800, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ],
    arrowCost: 1,
    // Custom: Spends arrows, updates Wind Force, and applies Cyclone Bow traits; see `galeshot/execution/index.ts`.
    handlerId: 'ranger.cyclone-bow-skill',
    quicknessCastTimeMs: 680,
    windForceGain: 1,
    windForceApplyMs: 280
  },
  [ID.SUPERSONIC_ARROW]: {
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 800, coefficient: 4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ],
    arrowCost: 3,
    // Custom: Spends arrows, updates Wind Force, and applies Cyclone Bow traits; see `galeshot/execution/index.ts`.
    handlerId: 'ranger.cyclone-bow-skill',
    quicknessCastTimeMs: 1000,
    windForceGain: 2,
    windForceApplyMs: 760
  }
});
