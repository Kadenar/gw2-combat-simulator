import { dataField, defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Mesmer illusion, shatter, and flip recipes read only by Mesmer mechanics. */
export const MESMER_CORE_SKILL_FIELDS = defineFields(
  {
    // Summons a phantasm whose attacks follow its timing recipe.
    phantasm: dataField,
    // Overrides the summoned phantasm's attack timing.
    phantasmTiming: dataField,
    // Fraction of the cast at which the phantasm is summoned; an interruption after it keeps the summon.
    phantasmSummonProgress: numberField({ maximum: 1 }),
    // Counts as a blade-producing skill for blade-dependent mechanics.
    blade: dataField,
    // Rewinder removes recharge for each player/clone source.
    rechargeReductionPerSource: numberField({ unit: 'seconds', patch: 'primary' }),
    // Continuum's snapshot lifetime increases for each shatter source.
    durationPerTier: numberField({ unit: 'seconds', patch: 'primary' }),
    // Ready Signet of Illusions generates resources at this interval.
    pulseInterval: numberField({ unit: 'seconds', patch: 'primary' }),
    // Shatter recipe consuming the live illusions.
    shatter: dataField,
    // Arms its follow-up flip when the cast starts rather than when it commits.
    armedAtStart: dataField,
    // Intrinsic follow-up window this skill opens.
    flipArm: dataField,
    // Fraction of the parent skill's base recharge added when this flip is used.
    parentCooldownIncrease: numberField(),
    // Hits whose damage this skill records for a later payout.
    trackedHitDamage: dataField
  },
  'Mesmer Core'
);

/** Declares mesmer core profile tuning once for validation, patch controls, and labels. */
export const MESMER_CORE_PROFILE_FIELDS = defineFields({
  // Strike, condition, and general damage scaling.
  activatingFactor: numberField({ patch: 'primary', unit: 'factor' }),
  idleFactor: numberField({ patch: 'primary', unit: 'factor' }),
  highHealthFactor: numberField({ patch: 'primary', unit: 'factor' }),
  lowHealthOrDisabledFactor: numberField({ patch: 'primary', unit: 'factor' }),

  // Stacks, targets, and proc gates.
  additionalStacks: numberField({ patch: 'primary' }),

  // Durations, extensions, and recurring effects.
  maximumDuration: numberField({ patch: 'primary', unit: 'seconds' }),
  summons: numberField({ patch: 'advanced' })
});
