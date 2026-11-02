import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Bladesworn gunsaber and Dragon Slash fields read only by Bladesworn mechanics. */
export const BLADESWORN_SKILL_FIELDS = defineFields(
  {
    // Dragon Trigger owns its baseline charge capacity and entry charge.
    maximumCharges: numberField({ patch: 'primary' }),
    // Flow drained per charge interval while Dragon Trigger charges.
    resourceCost: numberField({ patch: 'primary' }),
    entryResourceCost: numberField({ patch: 'primary' }),
    // Milliseconds from release to the Dragon Slash impact.
    dragonSlashImpactOffsetMs: numberField({ unit: 'milliseconds' }),
    // Strike coefficient at the minimum charge.
    dragonSlashMinimumCoefficient: numberField(),
    // Strike coefficient at the maximum charge.
    dragonSlashMaximumCoefficient: numberField(),
    // Burning duration at the minimum charge.
    dragonSlashMinimumBurningDuration: numberField(),
    // Burning duration at the maximum charge.
    dragonSlashMaximumBurningDuration: numberField()
  },
  'Bladesworn'
);

/** Declares warrior specializations bladesworn profile tuning once for validation, patch controls, and labels. */
export const WARRIOR_BLADESWORN_PROFILE_FIELDS = defineFields({
  // Recharge, resource costs, and regeneration.
  resourceCostMultiplier: numberField({ patch: 'primary', unit: 'factor' })
});
