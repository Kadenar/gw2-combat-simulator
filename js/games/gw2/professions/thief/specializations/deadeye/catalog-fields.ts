import { dataField, defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Deadeye fields read only by Deadeye mechanics. */
export const DEADEYE_SKILL_FIELDS = defineFields(
  {
    // Skill-owned tuning remains independently patchable from shared execution policy.
    initiativePerMalice: numberField({ label: 'initiative restored per malice', patch: 'primary' }),
    durationPerMalice: numberField({ label: 'condition duration per malice', patch: 'primary', unit: 'seconds' }),
    coefficientPerMalice: numberField({ label: 'final strike scaling per malice', patch: 'primary' }),

    // Spends malice for its enhanced variant.
    malicious: dataField
  },
  'Deadeye'
);
