import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Mesmer illusion, shatter, and flip recipes read only by Mesmer mechanics. */
export const MESMER_CORE_SKILL_FIELDS = defineFields(
  {
    // Fraction of the cast at which the phantasm is summoned; an interruption after it keeps the summon.
    phantasmSummonProgress: numberField({ maximum: 1 }),
    // Rewinder removes recharge for each player/clone source.
    rechargeReductionPerSource: numberField({ unit: 'seconds', patch: 'primary' }),
    // Continuum's snapshot lifetime increases for each shatter source.
    durationPerTier: numberField({ unit: 'seconds', patch: 'primary' }),
    // Ready Signet of Illusions generates resources at this interval.
    pulseInterval: numberField({ unit: 'seconds', patch: 'primary' }),
    // Fraction of the parent skill's base recharge added when this flip is used.
    parentCooldownIncrease: numberField()
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
