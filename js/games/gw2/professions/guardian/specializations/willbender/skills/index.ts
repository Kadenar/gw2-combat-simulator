/**
 * Owns Willbender virtue and physical skill fragments.
 * Runtime virtue behavior remains under `mechanics/` and `execution/virtues.ts`.
 */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const WILLBENDER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.ROILING_LIGHT]: {
    castTimeMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 0.33,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'control'
      },
      {
        type: 'blind'
      }
    ]
  },
  [ID.WILLBENDER_FLAMES]: {
    castTimeMs: 0,
    effects: []
  },
  [ID.CRASHING_COURAGE]: {
    castTimeMs: 680,
    // Custom: Runs the core virtue transition, Willbender windows, and flame scheduling; see `willbender/execution/virtues.ts`.
    handlerId: 'guardian.willbender-virtue',
    // Grant the virtue's defensive boons with its initial strike.
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        name: 'Crashing Courage — Initial Damage'
      },
      {
        type: 'boon',
        boon: 'aegis',
        stacks: 1,
        duration: 4
      },
      {
        type: 'boon',
        boon: 'stability',
        stacks: 1,
        duration: 4
      }
    ])
  },
  [ID.HEEL_CRACK]: {
    castTimeMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'control'
      }
    ]
  },
  [ID.HEAVENS_PALM]: {
    castTimeMs: 960,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'knockback'
      }
    ]
  },
  [ID.WHIRLING_LIGHT]: {
    castTimeMs: 960,
    interruptCommitMs: 920,
    cooldown: 15,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        // Resolve one bolt per strike so field expiry and ignition cooldowns apply to each pulse.
        ticks: [280, 480, 680, 880].map((atMs) => ({
          atMs,
          coefficient: 1,
          comboFinishers: [
            {
              ownerId: 'guardian',
              finisherType: 'Whirl' as const,
              attemptGroup: `whirl:${atMs}`,
              // Overlapping fields compete by age, regardless of their combo outcome.
              ambiguousFieldSelection: 'oldest' as const
            }
          ]
        }))
      },
      {
        type: 'condition',
        ticks: [280, 480, 680, 880].map((atMs) => ({
          atMs,
          condition: 'Weakness',
          stacks: 1,
          duration: 3
        }))
      },
      {
        type: 'condition',
        ticks: [280, 480, 680, 880].map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 3
        }))
      }
    ])
  },
  [ID.FLOWING_RESOLVE]: {
    castTimeMs: 520,

    ammoCastLockout: 0.5,
    // Custom: Runs the core virtue transition, Willbender windows, and flame scheduling; see `willbender/execution/virtues.ts`.
    handlerId: 'guardian.willbender-virtue',
    effects: []
  },
  [ID.FLASH_COMBO]: {
    castTimeMs: 680,
    cooldown: 20,
    interruptMode: 'per-packet',
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
        timingAnchor: 'castStart',
        timingScale: 'cast',
        ticks: [120, 280, 400, 520, 600].map((atMs) => ({ atMs, coefficient: 0.9 }))
      }
    ]
  },
  [ID.WILLBENDER_FLAMES_ID_62618]: {
    castTimeMs: 0,
    effects: []
  },
  [ID.REVERSAL_OF_FORTUNE]: {
    castTimeMs: 680,
    effects: []
  },
  [ID.RUSHING_JUSTICE]: {
    castTimeMs: 480,
    rechargeAnchor: 'castStart',
    // Custom: Runs the core virtue transition, Willbender windows, and flame scheduling; see `willbender/execution/virtues.ts`.
    handlerId: 'guardian.willbender-virtue',
    // Keep the virtue's impact strike and initial Burning together.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        name: 'Rushing Justice — Impact Damage'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 4,
        name: 'Rushing Justice — Initial Burning'
      }
    ])
  },
  [ID.REPOSE]: {
    castTimeMs: 200,
    effects: []
  },
  [ID.QUICK_RETRIBUTION]: {
    castTimeMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  }
});
