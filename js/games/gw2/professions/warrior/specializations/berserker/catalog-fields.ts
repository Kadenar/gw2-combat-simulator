import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Berserker fields read only by Berserker mechanics. */
export const BERSERKER_SKILL_FIELDS = defineFields(
  {
    // Base extension belongs to each completed Rage skill.
    durationExtension: numberField({ unit: 'seconds', patch: 'primary' })
  },
  'Berserker'
);
