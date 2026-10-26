import { dataField, defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Thief initiative, stealth, and Steal fields read only by Thief mechanics. */
export const THIEF_CORE_SKILL_FIELDS = defineSkillFields(
  {
    // Skill-owned tuning remains independently patchable from shared execution policy.
    initiativeRefund: numberField({ label: 'initiative refunded', patch: 'primary' }),
    enduranceGain: numberField({ label: 'endurance restored', patch: 'primary' }),
    activePowerBonus: numberField({ label: 'active power bonus', patch: 'primary' }),
    empoweredDamageMultiplier: numberField({ label: 'empowered damage multiplier', patch: 'primary' }),
    empoweredConditionStacks: numberField({ label: 'empowered bonus condition stacks', patch: 'primary' }),

    // Initiative spent by the skill.
    initiativeCost: numberField({ label: 'initiative cost', patch: 'primary' }),
    // Uses the off-hand weapon's dual-wield opener.
    dualWieldOpener: dataField,
    // Available only while kneeling.
    kneelSkill: dataField,
    // Does not reveal the player when used from stealth.
    preservesStealth: dataField,
    // Spear stealth attack replacing the autoattack.
    spearStealthAttack: dataField,
    // Steal variant selected by a trait.
    stealTraitSkill: dataField,
    // Attack performed by the summoned thieves.
    summonAttack: dataField
  },
  'Thief Core'
);
