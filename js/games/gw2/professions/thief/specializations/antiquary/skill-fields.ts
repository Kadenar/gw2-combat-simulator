import { dataField, defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Antiquary artifact fields read only by Antiquary mechanics. */
export const ANTIQUARY_SKILL_FIELDS = defineSkillFields(
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
