import { dataField, defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Warrior adrenaline and burst fields read only by Warrior mechanics. */
export const WARRIOR_CORE_SKILL_FIELDS = defineSkillFields(
  {
    // Spends adrenaline as a burst skill.
    burst: dataField,
    // Intrinsic skill tuning is editable on its canonical owner.
    enduranceRegenerationBonus: numberField({ patch: 'primary' }),
    activeAttributeBonus: numberField({ patch: 'primary' }),
    pulseInterval: numberField({ unit: 'seconds', patch: 'primary' }),
    durationPerTier: numberField({ unit: 'seconds', patch: 'primary' }),
    // Adrenaline spent by the skill.
    adrenalineCost: numberField()
  },
  'Warrior Core'
);
