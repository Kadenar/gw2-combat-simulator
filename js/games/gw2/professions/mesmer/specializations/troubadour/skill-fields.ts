import { dataField, defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Troubadour instrument and performance fields read only by Troubadour mechanics. */
export const TROUBADOUR_SKILL_FIELDS = defineSkillFields(
  {
    // Authored instrument identity for capacity queries.
    instrument: dataField,
    // Performance reward and the instruments it requires.
    tale: dataField,
    // Profile owning the Crescendo payload of this tale.
    crescendoProfileId: dataField,
    // Milliseconds after the cast starts when the payload lands.
    damageAtMs: numberField({ unit: 'milliseconds' })
  },
  'Troubadour'
);
