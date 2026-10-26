import { dataField, defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Bladesworn gunsaber and Dragon Slash fields read only by Bladesworn mechanics. */
export const BLADESWORN_SKILL_FIELDS = defineSkillFields(
  {
    // Available only while the gunsaber is drawn.
    gunsaberSkill: dataField,
    // Dragon Trigger charge skill.
    dragonTriggerSkill: dataField,
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
