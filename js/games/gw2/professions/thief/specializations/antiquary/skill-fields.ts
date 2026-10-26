import { dataField, defineSkillFields } from '#gw2/platform/skills/field-specs.js';

/** Antiquary artifact fields read only by Antiquary mechanics. */
export const ANTIQUARY_SKILL_FIELDS = defineSkillFields(
  {
    // Artifact this skill stocks or spends.
    artifactKind: dataField,
    // Has a backfire outcome selected in the rotation.
    backfire: dataField
  },
  'Antiquary'
);
