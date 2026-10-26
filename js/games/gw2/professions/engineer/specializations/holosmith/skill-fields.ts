import { dataField, defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Holosmith heat and Photon Forge fields read only by Holosmith mechanics. */
export const HOLOSMITH_SKILL_FIELDS = defineSkillFields(
  {
    // Skill-owned tuning is shared by combat and presentation.
    baseDuration: numberField({ patch: 'primary', unit: 'seconds' }),
    // Skill-owned tuning is shared by combat and presentation.
    highStrikeFactor: numberField({ patch: 'primary' }),
    enhancedStrikeFactor: numberField({ patch: 'primary' }),
    basePacketCount: numberField({ patch: 'primary' }),
    highPacketCount: numberField({ patch: 'primary' }),
    packetInterval: numberField({ patch: 'primary', unit: 'seconds' }),
    initialDelay: numberField({ patch: 'primary', unit: 'seconds' }),
    packetCount: numberField({ patch: 'primary' }),
    enhancedConditionBaseDurationFactor: numberField({ patch: 'primary' }),
    highDuration: numberField({ patch: 'primary', unit: 'seconds' }),
    enhancedDuration: numberField({ patch: 'primary', unit: 'seconds' }),
    baseExtraBlades: numberField({ patch: 'primary' }),
    highExtraBlades: numberField({ patch: 'primary' }),
    enhancedExtraBlades: numberField({ patch: 'primary' }),
    kitLockoutDuration: numberField({ patch: 'primary', unit: 'seconds' }),
    // Marks skills available only inside Photon Forge.
    forgeSkill: dataField,
    // Heat added when the skill is used.
    heatGain: numberField(),
    // Heat removed when the skill is used.
    heatLoss: numberField({ patch: 'primary' })
  },
  'Holosmith'
);
