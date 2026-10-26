import { CONTROL, BOON, CONDITION } from '#gw2/platform/constants.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { RangerSkill, RangerRuntime, RangerRuntimeState } from '#gw2/professions/ranger/types.js';
import { RANGER_HAMMER_VARIANT_PAIRS } from '#gw2/professions/ranger/data/hammer-variants.js';

/** Each slot shares its live recharge across variants, including cancelled casts. */
function synchronizeHammerRecharge(runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>): void {
  const pair = RANGER_HAMMER_VARIANT_PAIRS.find((ids) => ids.includes(Number(cast.skill.id)));
  for (const id of pair || []) runtime.cooldownController.copy(cast.skill.id, id);
}

/** Commit and cancellation both synchronize the recharge already started by the runtime. */
export const hammerLifecycle = {
  onCastCommit: synchronizeHammerRecharge,
  onCastCancel: synchronizeHammerRecharge
} satisfies RuntimeHooks<RangerRuntimeState, RangerSkill>;

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
export const RANGER_CORE_HAMMER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.HAMMER_STRIKE]: {
    castTimeMs: 480,
    interruptCommitMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 360, coefficient: 0.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HAMMER_SLAM]: {
    castTimeMs: 640,
    interruptCommitMs: 320,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HEAVY_SMASH]: {
    castTimeMs: 440,
    interruptCommitMs: 320,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 1.4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.WILD_SWING]: {
    castTimeMs: 480,
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 5
      }
    ])
  },
  [ID.UNLEASHED_WILD_SWING]: {
    castTimeMs: 480,
    interruptCommitMs: 400,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        damageKind: 'ranger-unleashed-disabled'
      }
    ]
  },
  [ID.OVERBEARING_SMASH]: {
    castTimeMs: 960,
    interruptCommitMs: 240,
    effects: [
      ...impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.4
        },
        {
          type: 'control',
          controlKind: CONTROL.DAZE
        }
      ]),
      ...impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          sourceId: ID.OVERBEARING_SMASH_SECOND_STRIKE,
          coefficient: 1
        },
        {
          type: 'control',
          sourceId: ID.OVERBEARING_SMASH_SECOND_STRIKE,
          controlKind: CONTROL.DAZE
        }
      ])
    ]
  },
  [ID.UNLEASHED_OVERBEARING_SMASH]: {
    castTimeMs: 960,
    // Keep the opening impact when cancelled between hits; the follow-up requires reaching its own packet.
    interruptMode: 'per-packet',
    effects: [
      ...impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.75
        },
        {
          type: 'condition',
          condition: CONDITION.BLINDNESS,
          stacks: 1,
          duration: 2
        }
      ]),
      {
        type: 'strike',
        sourceId: ID.OVERBEARING_SMASH_SECOND_STRIKE,
        ticks: [{ atMs: 960, coefficient: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Unleashed Overbearing Smash - Follow-Up Damage'
      }
    ]
  },
  [ID.SAVAGE_SHOCK_WAVE]: {
    castTimeMs: 560,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 520, coefficient: 0.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: BOON.PROTECTION,
        duration: 3,
        stacks: 1
      },
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'condition',
          condition: CONDITION.WEAKNESS,
          stacks: 1,
          duration: 4
        },
        {
          type: 'condition',
          condition: CONDITION.VULNERABILITY,
          stacks: 8,
          duration: 6
        },
        {
          type: 'condition',
          condition: CONDITION.IMMOBILIZED,
          stacks: 1,
          duration: 2
        }
      ])
    ]
  },
  [ID.UNLEASHED_SAVAGE_SHOCK_WAVE]: {
    castTimeMs: 560,
    interruptCommitMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [520, 800, 1080].map((atMs) => ({
          atMs,
          coefficient: 0.8
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        damageKind: 'ranger-unleashed-disabled-condition-count'
      }
    ]
  },
  [ID.THUMP]: {
    castTimeMs: 960,
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.25
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKDOWN
      }
    ])
  },
  [ID.UNLEASHED_THUMP]: {
    castTimeMs: 960,
    interruptCommitMs: 800,
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.3
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 6.5,
        stacks: 6
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 6.5,
        stacks: 1
      }
    ])
  }
});

/** Intrinsic live-impact policy stays beside its skill; the shared registry supplies resolution. */
export const rangerHammerDisabledModifier: Gw2ModifierRule = {
  id: 'ranger.disabled-skill-bonus',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  factor: 1.2,
  when: (context) =>
    Boolean(
      String(context.event?.damageKind || '').startsWith('ranger-unleashed-disabled') && context.config?.target?.defiant
    )
};

/** Intrinsic live-impact policy stays beside its skill; the shared registry supplies resolution. */
export const rangerHammerConditionsModifier: Gw2ModifierRule = {
  id: 'ranger.condition-count-skill-bonus',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  parameters: { baseFactor: 1, damagePerCondition: 0.02 },
  // Canonical queries deduplicate aliases and count only conditions active at this observation time.
  factor: (context, _target, parameters) =>
    parameters.baseFactor + targetConditionCount(context) * parameters.damagePerCondition,
  when: (context) => context.event?.damageKind === 'ranger-unleashed-disabled-condition-count'
};
