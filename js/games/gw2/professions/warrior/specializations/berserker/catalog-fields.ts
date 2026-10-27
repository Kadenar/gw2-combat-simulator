import { dataField, defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Berserker fields read only by Berserker mechanics. */
export const BERSERKER_SKILL_FIELDS = defineFields(
  {
    // Primal burst available only while berserk.
    primalBurst: dataField,
    // Base extension belongs to each completed Rage skill.
    durationExtension: numberField({ unit: 'seconds', patch: 'primary' })
  },
  'Berserker'
);
