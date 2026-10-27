import { attributeFields } from '#gw2/platform/skills/attribute-fields.js';
import { dataField, defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Warrior adrenaline and burst fields read only by Warrior mechanics. */
export const WARRIOR_CORE_SKILL_FIELDS = defineFields(
  {
    // Spends adrenaline as a burst skill.
    burst: dataField,
    // Intrinsic skill tuning is editable on its canonical owner.
    enduranceRegenerationBonus: numberField({ patch: 'primary' }),
    ...attributeFields('activeAttributeBonuses', 'Active '),
    pulseInterval: numberField({ unit: 'seconds', patch: 'primary' }),
    durationPerTier: numberField({ unit: 'seconds', patch: 'primary' }),
    // Adrenaline spent by the skill.
    adrenalineCost: numberField()
  },
  'Warrior Core'
);

/** Declares warrior core profile tuning once for validation, patch controls, and labels. */
export const WARRIOR_CORE_PROFILE_FIELDS = defineFields({
  // Recharge, resource costs, and regeneration.
  bladeswornResourceGain: numberField({ patch: 'primary' }),

  // Strike, condition, and general damage scaling.
  baseBonus: numberField({ patch: 'primary' }),
  activeBonus: numberField({ patch: 'primary' }),

  // Stacks, targets, and proc gates.
  stackMultiplier: numberField({ patch: 'primary', unit: 'factor' }),
  weaponProcChanceMultiplier: numberField({ patch: 'primary', unit: 'factor' })
});
