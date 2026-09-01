import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const WILLBENDER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.ROILING_LIGHT]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: 'strike',
        coefficient: 0.33,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'control'
        }
      },
      {
        type: 'blind'
      }
    ]
  },
  [ID.WILLBENDER_FLAMES]: {
    implemented: true,
    castTimeMs: 0,
    effects: []
  },
  [ID.CRASHING_COURAGE]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    handlerId: 'guardian.willbender-virtue',
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 520, coefficient: 1 }],
        name: 'Crashing Courage — Initial Damage',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'aegis',
        stacks: 1,
        duration: 4,
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'stability',
        stacks: 1,
        duration: 4,
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HEEL_CRACK]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'control'
        }
      }
    ]
  },
  [ID.HEAVENS_PALM]: {
    implemented: true,
    quicknessCastTimeMs: 960,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'knockback'
        }
      }
    ]
  },
  [ID.WHIRLING_LIGHT]: {
    implemented: true,
    quicknessCastTimeMs: 960,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        comboFinishers: [
          {
            ownerId: 'guardian',
            finisherType: 'Whirl',
            applications: 4,
            ambiguousFieldSelection: 'oldest',
            preferredFieldTypes: ['Fire']
          }
        ],
        ticks: [280, 480, 680, 880].map((atMs) => ({
          atMs,
          coefficient: 1
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [280, 480, 680, 880].map((atMs) => ({
          atMs,
          condition: 'Weakness',
          stacks: 1,
          duration: 3
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [280, 480, 680, 880].map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 3
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.FLOWING_RESOLVE]: {
    implemented: true,
    castTimeMs: 520,
    unaffectedByQuickness: true,
    ammoCastLockout: 0.5,
    handlerId: 'guardian.willbender-virtue',
    effects: []
  },
  [ID.FLASH_COMBO]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    cooldown: 20,
    // Flash Combo exposes Repose for six seconds after the cast completes.
    mechanicTriggers: [
      {
        type: 'guardian.willbender.arm-repose',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 4.5,
        hits: 5,
        atMs: 0
      }
    ]
  },
  [ID.WILLBENDER_FLAMES_ID_62618]: {
    implemented: true,
    castTimeMs: 0,
    effects: []
  },
  [ID.REVERSAL_OF_FORTUNE]: {
    implemented: true,
    castTimeMs: 1000,
    effects: []
  },
  [ID.RUSHING_JUSTICE]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    rechargeAnchor: 'castStart',
    handlerId: 'guardian.willbender-virtue',
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 440, coefficient: 1.5 }],
        name: 'Rushing Justice — Impact Damage',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: 'Burning', stacks: 1, duration: 4 }],
        name: 'Rushing Justice — Initial Burning',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.REPOSE]: {
    implemented: true,
    castTimeMs: 250,
    effects: []
  },
  [ID.QUICK_RETRIBUTION]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  }
});
