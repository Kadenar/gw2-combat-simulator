import { dataField, defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Revenant energy, upkeep, and legend fields read only by Revenant mechanics. */
export const REVENANT_CORE_SKILL_FIELDS = defineSkillFields(
  {
    // Legend that owns this skill.
    legendId: dataField,
    // Energy spent when the skill activates.
    energyCost: numberField({ label: 'energy cost', patch: 'primary' }),
    // Energy drained per second while the upkeep is active.
    upkeepCost: numberField({ patch: 'primary' }),
    // Seconds between pulses of the active upkeep or channel.
    pulseInterval: numberField({ unit: 'seconds', patch: 'advanced' }),
    // Recharge in seconds after the upkeep is released manually.
    manualReleaseCooldown: numberField(),
    // Recharge in seconds after the upkeep ends from lack of energy.
    starvationCooldown: numberField(),
    // Milliseconds between triggered packets.
    triggerIntervalMs: numberField({ unit: 'milliseconds' })
  },
  'Revenant Core'
);
