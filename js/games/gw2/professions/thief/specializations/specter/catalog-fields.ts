import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Specter fields read only by Specter mechanics. */
export const SPECTER_SKILL_FIELDS = defineFields(
  {
    // Skill-owned tuning remains independently patchable from shared execution policy.
    shadowForceGain: numberField({ label: 'Shadow Force gained', patch: 'primary' })
  },
  'Specter'
);
