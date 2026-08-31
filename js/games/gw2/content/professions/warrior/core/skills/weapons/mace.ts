/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const WARRIOR_WEAPONS_MACE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.MACE_SMASH]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  },
  [ID.MACE_BASH]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  },
  [ID.PULVERIZE]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5
      }
    ]
  },
  [ID.TREMOR]: {
    implemented: true,
    // Tremor refreshes Crushing Blow when its cast completes.
    mechanicTriggers: [
      {
        type: 'warrior.core.reset-crushing-blow',
        timingAnchor: 'castEnd'
      }
    ],
    quicknessCastTimeMs: 560,
    dualWieldCastTimeMs: 400,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 440, coefficient: 1.25 },
          { atMs: 480, coefficient: 1.25 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'knockdown',
          duration: 3
        }
      }
    ]
  },
  [ID.POMMEL_BASH]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'daze',
          duration: 1
        }
      }
    ]
  },
  [ID.COUNTERBLOW]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineGain: 5,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 8
      }
    ]
  },
  [ID.CRUSHING_BLOW]: {
    implemented: true,
    quicknessCastTimeMs: 560,
    dualWieldCastTimeMs: 400,
    interruptCommitMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 6,
        stacks: 5,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 6,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.TACTICAL_BLOW]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineGain: 5,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 8
      }
    ]
  }
});
