import { dataField, defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Troubadour instrument and performance fields read only by Troubadour mechanics. */
export const TROUBADOUR_SKILL_FIELDS = defineFields(
  {
    // Authored instrument identity for capacity queries.
    instrument: dataField,
    // Performance reward and the instruments it requires.
    tale: dataField,
    // Eligible Tale performances award notes separately from Honorable Rogue's endurance.
    noteGain: numberField({ patch: 'primary' }),
    // August Queen starts all instruments with this base duration.
    baseDuration: numberField({ unit: 'seconds', patch: 'primary' }),
    // Crescendo scales only with instruments still playing at impact.
    damageIncreasePerInstrument: numberField({ patch: 'primary' }),
    // Cry of Pain strengthens Flute without changing other Confusion sources.
    cryOfPainAdditionalStacks: numberField({ patch: 'primary' }),
    cryOfPainDurationMultiplier: numberField({ patch: 'primary' }),
    // Milliseconds after the cast starts when the payload lands.
    damageAtMs: numberField({ unit: 'milliseconds' })
  },
  'Troubadour'
);
