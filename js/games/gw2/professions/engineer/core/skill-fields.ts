import { dataField, defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Engineer toolbelt and command-face fields read only by Engineer mechanics. */
export const ENGINEER_CORE_SKILL_FIELDS = defineSkillFields(
  {
    // Skill-owned tuning is shared by combat and presentation.
    chargesPerVulnerability: numberField({ patch: 'primary' }),
    focusedChargesPerVulnerability: numberField({ patch: 'primary' }),
    burningDurationPerCharge: numberField({ patch: 'primary', unit: 'seconds' }),
    focusedBurningDurationPerCharge: numberField({ patch: 'primary', unit: 'seconds' }),
    criticalDamage: numberField({ patch: 'primary' }),
    // Elite tools count as toolbelt skills for toolbelt-triggered traits.
    countsAsToolbeltSkill: dataField,
    // Armed command faces require their parent's successful activation before casting.
    requiresArmedFlip: dataField,
    // The slot skill whose toolbelt companion this skill is.
    toolbeltParentId: dataField
  },
  'Engineer Core'
);
