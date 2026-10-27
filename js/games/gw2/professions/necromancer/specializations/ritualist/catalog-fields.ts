import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Spirit actor startup and impact tuning are owned by each autonomous attack skill. */
export const RITUALIST_SKILL_FIELDS = defineFields(
  {
    initialBusyMs: numberField({ unit: 'milliseconds', patch: 'advanced' }),
    autoattackImpactDelayMs: numberField({ unit: 'milliseconds', patch: 'advanced' })
  },
  'Ritualist'
);
