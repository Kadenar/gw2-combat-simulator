import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Galeshot arrow and wind-force fields read only by Galeshot mechanics. */
export const GALESHOT_SKILL_FIELDS = defineFields(
  {
    // Arrows spent by the Cyclone Bow skill.
    arrowCost: numberField({ patch: 'primary' }),
    // Arrows restored by the skill.
    arrowsRestored: numberField({ patch: 'primary' }),
    // Wind force gained by the skill.
    windForceGain: numberField({ patch: 'primary' }),
    // Milliseconds into the cast when the wind force gain applies.
    windForceApplyMs: numberField({ unit: 'milliseconds', patch: 'primary' })
  },
  'Galeshot'
);
