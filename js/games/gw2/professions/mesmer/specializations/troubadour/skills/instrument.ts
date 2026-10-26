import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerInstrument } from '#gw2/professions/mesmer/types.js';

/** Builds the canonical skill payload for one Troubadour instrument. */
export function instrumentSkill(skill: Partial<MesmerSkill> & { instrument: MesmerInstrument }): Partial<MesmerSkill> {
  const instrument = skill.instrument;
  return {
    ...skill,
    instrument: {
      hasStrike: Boolean(instrument.ticks?.length || Number(instrument.hits) > 0),
      slot: instrument.slot,
      instrument: instrument.instrument,
      damageAtMs: instrument.damageAtMs,
      persistsAfterInterrupt: instrument.persistsAfterInterrupt
    },
    effects: [
      ...(skill.effects ?? []),
      ...(instrument.ticks?.length
        ? [
            {
              name: 'Strike',
              type: 'strike' as const,
              ticks: instrument.ticks,
              timingAnchor: 'castEnd' as const,
              timingScale: 'fixed' as const
            }
          ]
        : Number(instrument.hits) > 0
          ? [{ name: 'Strike', type: 'strike' as const, coefficient: instrument.coefficient, hits: instrument.hits }]
          : []),
      ...(instrument.conditions || []).map((status) => ({
        ...status,
        name: status.condition
      }))
    ]
  };
}
