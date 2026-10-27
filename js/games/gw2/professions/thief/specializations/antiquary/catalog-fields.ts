import { dataField, defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Antiquary artifact fields read only by Antiquary mechanics. */
export const ANTIQUARY_SKILL_FIELDS = defineFields(
  {
    // Skill-owned tuning remains independently patchable from shared execution policy.
    pulseInterval: numberField({ label: 'repeat interval', patch: 'primary', unit: 'seconds' }),
    // Repeat-schedule timing internal; not a patch-note value, so authoring never shows it.
    initialDelay: numberField({ unit: 'seconds', runtimeOnly: true }),
    backfireDelay: numberField({ label: 'backfire delay', patch: 'primary', unit: 'seconds' }),
    enhancedDuration: numberField({ label: 'enhanced identity duration', patch: 'primary', unit: 'seconds' }),
    maximumDuration: numberField({ label: 'maximum identity duration', patch: 'primary', unit: 'seconds' }),
    refundCharges: numberField({ label: 'initiative refund charges', patch: 'primary' }),
    rechargeMultiplier: numberField({ label: 'next utility recharge multiplier', patch: 'primary' }),

    // Artifact this skill stocks or spends.
    artifactKind: dataField,
    // Has a backfire outcome selected in the rotation.
    backfire: dataField
  },
  'Antiquary'
);

/** Declares thief specializations antiquary profile tuning once for validation, patch controls, and labels. */
export const THIEF_ANTIQUARY_PROFILE_FIELDS = defineFields({
  // Strike, condition, and general damage scaling.
  guitarFactor: numberField({ patch: 'primary', unit: 'factor' }),
  guitarFinalFactor: numberField({ patch: 'primary', unit: 'factor' }),
  mortarFactor: numberField({ patch: 'primary', unit: 'factor' }),
  chakFactor: numberField({ patch: 'primary', unit: 'factor' }),
  kryptisFactor: numberField({ patch: 'primary', unit: 'factor' }),
  holoFactor: numberField({ patch: 'primary', unit: 'factor' }),

  // Durations, extensions, and recurring effects.
  mortarBurningDurationMultiplier: numberField({ patch: 'primary', unit: 'factor' }),
  sunCrystalBurningDurationMultiplier: numberField({ patch: 'primary', unit: 'factor' }),
  kryptisTormentDurationMultiplier: numberField({ patch: 'primary', unit: 'factor' }),
  kryptisDuration: numberField({ patch: 'primary', unit: 'seconds' })
});
