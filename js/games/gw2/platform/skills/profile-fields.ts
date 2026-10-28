import { attributeFields } from '#gw2/platform/skills/attribute-fields.js';
import {
  assertFieldGroups,
  combineFields,
  dataField,
  defineFields,
  numberField,
  type FieldSpecs
} from '#gw2/platform/skills/field-specs.js';

/** Declares shared profile tuning once for validation, patch controls, and labels. */
export const SHARED_PROFILE_FIELDS: FieldSpecs = defineFields({
  // Identity, presentation, and executable declarations.
  id: dataField,
  name: dataField,
  description: dataField,
  icon: dataField,
  variantBadge: dataField,
  categories: dataField,
  skillFamily: dataField,
  balanceDataContext: dataField,
  removedEffectKeys: dataField,
  effects: dataField,
  cooldownPolicy: dataField,
  procRate: dataField,

  // Recharge, resource costs, and regeneration.
  cooldown: numberField({ patch: 'primary', unit: 'seconds' }),
  recharge: numberField({ patch: 'primary', unit: 'seconds' }),
  rechargeMultiplier: numberField({ patch: 'primary', unit: 'factor' }),
  rechargeReduction: numberField({ patch: 'primary' }),
  resourceGain: numberField({ patch: 'primary' }),
  energyRegenerationPerSecond: numberField({ patch: 'primary' }),
  enduranceRegenerationMultiplier: numberField({ patch: 'primary', unit: 'factor' }),
  lifeForceDrain: numberField({ patch: 'primary' }),
  lifeForceGain: numberField({ patch: 'primary' }),

  // Strike, condition, and general damage scaling.
  coefficientMultiplier: numberField({ patch: 'primary', unit: 'factor' }),
  damageMultiplier: numberField({ patch: 'primary', unit: 'factor' }),
  damageIncrease: numberField({ patch: 'primary', unit: 'fraction' }),
  damageIncreasePerStack: numberField({ patch: 'primary', unit: 'fraction' }),
  conditionDamageMultiplier: numberField({ patch: 'primary', unit: 'factor' }),
  conditionDamageIncrease: numberField({ patch: 'primary', unit: 'fraction' }),
  conditionDamageIncreasePerStack: numberField({ patch: 'primary', unit: 'fraction' }),
  damagePerBoon: numberField({ patch: 'primary', unit: 'fraction' }),
  damagePerCondition: numberField({ patch: 'primary', unit: 'fraction' }),

  // Tiered damage curves and activation thresholds.
  // Counter owners define nonpositive thresholds as disabled or immediately satisfied gates.
  threshold: numberField({ patch: 'primary', minimum: -Infinity }),
  lowerThreshold: numberField({ patch: 'primary' }),
  middleThreshold: numberField({ patch: 'primary' }),
  upperThreshold: numberField({ patch: 'primary' }),

  // Attributes, summon inheritance, and critical-hit scaling.
  attributeMultiplier: numberField({ patch: 'primary', unit: 'factor' }),
  attributeConversion: numberField({ patch: 'primary', unit: 'fraction' }),
  attributePerStack: numberField({ patch: 'primary' }),
  inheritanceRatio: numberField({ patch: 'primary', unit: 'fraction', maximum: 1 }),
  secondaryAttributeCap: numberField({ patch: 'primary', unit: 'attribute' }),
  powerCap: numberField({ patch: 'primary', unit: 'attribute' }),
  precisionCap: numberField({ patch: 'primary', unit: 'attribute' }),
  criticalChance: numberField({ patch: 'primary', unit: 'probability', maximum: 1 }),
  criticalDamage: numberField({ patch: 'primary' }),
  ...attributeFields(),
  ...attributeFields('conditionalAttributeBonuses', 'Conditional '),

  // Stacks, targets, and proc gates.
  maximumStacks: numberField({ patch: 'primary' }),
  minimumStacks: numberField({ patch: 'primary' }),
  playerStacks: numberField({ patch: 'primary' }),
  maximumBoons: numberField({ patch: 'primary' }),
  maximumConditions: numberField({ patch: 'primary' }),
  procChance: numberField({ patch: 'primary', unit: 'probability', maximum: 1 }),
  internalCooldown: numberField({ patch: 'primary', unit: 'seconds' }),

  // Durations, extensions, and recurring effects.
  duration: numberField({ patch: 'primary', unit: 'seconds' }),
  baseDuration: numberField({ patch: 'primary', unit: 'seconds' }),
  durationPerTier: numberField({ patch: 'primary', unit: 'seconds' }),
  durationMultiplier: numberField({ patch: 'primary', unit: 'factor' }),
  durationExtension: numberField({ patch: 'primary', unit: 'seconds' }),
  conditionDurationMultiplier: numberField({ patch: 'primary', unit: 'factor' }),
  conditionDurationBonus: numberField({ patch: 'primary', unit: 'fraction' }),
  pulseInterval: numberField({ patch: 'advanced', unit: 'seconds' })
});

/** Merge one profession's declarations with platform vocabulary, rejecting duplicate owners and orphaned leaves. */
export function professionProfileFields(professionFields?: FieldSpecs): FieldSpecs {
  const fields = combineFields([
    { owner: 'Shared profile fields', fields: SHARED_PROFILE_FIELDS },
    { owner: 'Profession profile fields', fields: professionFields }
  ]);
  assertFieldGroups(fields);
  return fields;
}
