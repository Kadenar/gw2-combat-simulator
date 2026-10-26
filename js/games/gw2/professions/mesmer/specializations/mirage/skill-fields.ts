import { dataField, defineSkillFields } from '#gw2/platform/skills/field-specs.js';

/** Mirage mirror and clone recipes read only by Mirage mechanics. */
export const MIRAGE_SKILL_FIELDS = defineSkillFields(
  {
    // Clone this skill summons.
    clone: dataField,
    // Payload a mirror replays for this skill.
    mirrorPayload: dataField,
    // Ambush payload applied by the player's own attack.
    player: dataField,
    // Vulnerability payload shared by the ambush variants.
    vulnerability: dataField
  },
  'Mirage'
);
