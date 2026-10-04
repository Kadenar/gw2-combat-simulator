import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { ActionContext } from '#gw2/platform/effects/actions.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/**
 * Owns Willbender virtue and physical skill fragments.
 * Runtime virtue behavior remains under `mechanics/` and `execution/virtues.ts`.
 */

export const WILLBENDER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.ROILING_LIGHT]: {
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [
      {
        on: 'castCommit',
        do: { type: 'flipArm', skillId: ID.QUICK_RETRIBUTION, durationSec: 15, expiryPriority: -220 }
      }
    ],
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
    // Accepted activations launch the self window and autonomous flame group.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.start-courage' } }
    ],
    castTimeMs: 680,
    // Grant the virtue's defensive boons with its initial strike.
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        // Virtue strikes use mechanic weapon strength independently of equipped weapons.
        weapon: 'Profession Mechanic',
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
    // Accepted activations launch the self window and autonomous flame group.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.start-resolve' } }
    ],
    castTimeMs: 520,

    ammoCastLockout: 0.5,
    effects: []
  },
  [ID.FLASH_COMBO]: {
    // Committed combos arm Repose, including shortened channels; old occurrences expire before same-time casts.
    sideEffects: [
      { on: 'castCommit', do: { type: 'flipArm', skillId: ID.REPOSE, durationSec: 6, expiryPriority: -220 } }
    ],
    castTimeMs: 680,
    cooldown: 20,
    interruptMode: 'per-packet',
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
    // Accepted activations launch the self window and autonomous flame group.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.start-justice' } }
    ],
    castTimeMs: 480,
    rechargeAnchor: 'castStart',
    // Both impact packets retain the impact identity; the strike uses mechanic weapon strength.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        sourceId: ID.RUSHING_JUSTICE_IMPACT,
        weapon: 'Profession Mechanic',
        name: 'Rushing Justice — Impact Damage'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 4,
        sourceId: ID.RUSHING_JUSTICE_IMPACT,
        name: 'Rushing Justice — Initial Burning'
      }
    ])
  },
  [ID.REPOSE]: {
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.REPOSE } }],
    castTimeMs: 200,
    effects: []
  },
  [ID.QUICK_RETRIBUTION]: {
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.QUICK_RETRIBUTION } }],
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

export const ACTIVATE = 'guardian.willbender.activate';
export const FLAMES = 'guardian.willbender.flames';
/** Activation recipes preserve the window/flame boundaries and priority ahead of shared lifetime work. */
export const willbenderVirtueActions: RuntimeProfession<GuardianRuntimeState, GuardianSkill>['sideEffectHandlers'] =
  Object.fromEntries(
    (
      [
        ['justice', (cast: RuntimeCast<GuardianSkill>) => Math.min(cast.effectiveEnd, cast.start + 0.04)],
        ['resolve', (cast: RuntimeCast<GuardianSkill>) => cast.effectiveEnd],
        ['courage', (cast: RuntimeCast<GuardianSkill>) => Math.min(cast.effectiveEnd, cast.start + 0.52)]
      ] as const
    ).map(([virtue, activationAt]) => [
      `guardian.start-${virtue}`,
      (runtime: MechanicContext<GuardianRuntimeState, GuardianSkill>, context: ActionContext<GuardianSkill>) => {
        if (context.kind !== 'cast') return;
        const cast = context.cast;
        const at = canonicalTime(activationAt(cast));
        const flameAt = canonicalTime(
          virtue === 'resolve' ? cast.start : virtue === 'justice' ? Math.max(at, cast.effectiveEnd - 0.04) : at
        );
        runtime.scheduleForCast(ACTIVATE, at, cast, { virtue });
        runtime.scheduleForCast(FLAMES, flameAt, cast, { virtue }, undefined, -10);
      }
    ])
  );
