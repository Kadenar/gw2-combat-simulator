import { dataField, defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Mesmer illusion, shatter, and flip recipes read only by Mesmer mechanics. */
export const MESMER_CORE_SKILL_FIELDS = defineSkillFields(
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
