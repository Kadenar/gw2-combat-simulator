import { dataField, defineFields } from '#gw2/platform/skills/field-specs.js';

/** Mirage mirror and clone recipes read only by Mirage mechanics. */
export const MIRAGE_SKILL_FIELDS = defineFields(
  {
    // Clone this skill summons.
    clone: dataField,
    // Payload a mirror replays for this skill.
    mirrorPayloadSkillId: dataField,
    // Ambush payload applied by the player's own attack.
    player: dataField,
    // Identifies the separately removable Vulnerability template on the skill.
    hasVulnerability: dataField
  },
  'Mirage'
);
