import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Spirit startup and impact timings are fixed runtime mechanics, excluded from patch editing and authoring references. */
export const RITUALIST_SKILL_FIELDS = defineFields(
  {
    initialBusyMs: numberField({ unit: 'milliseconds', runtimeOnly: true }),
    // Replacing a live spirit can take longer to finish its opening than summoning it into an empty slot.
    resummonBusyMs: numberField({ unit: 'milliseconds', runtimeOnly: true }),
    // Defensive spirit commands still reserve their actor even when they have no damaging effect.
    commandBusyMs: numberField({ unit: 'milliseconds', patch: 'advanced' }),
    autoattackImpactDelayMs: numberField({ unit: 'milliseconds', runtimeOnly: true })
  },
  'Ritualist'
);
