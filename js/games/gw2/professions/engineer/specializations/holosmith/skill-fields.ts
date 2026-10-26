import { dataField, defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Holosmith heat and Photon Forge fields read only by Holosmith mechanics. */
export const HOLOSMITH_SKILL_FIELDS = defineSkillFields(
  {
    // Marks skills available only inside Photon Forge.
    forgeSkill: dataField,
    // Heat added when the skill is used.
    heatGain: numberField(),
    // Heat removed when the skill is used.
    heatLoss: numberField({ patch: 'primary' })
  },
  'Holosmith'
);
