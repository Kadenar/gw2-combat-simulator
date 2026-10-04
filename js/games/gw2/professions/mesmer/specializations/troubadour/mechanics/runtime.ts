import { MESMER_TROUBADOUR_INSTRUMENTS } from '#gw2/professions/mesmer/specializations/troubadour/skills/index.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import {
  TROUBADOUR_INSTRUMENT_PROFILE_IDS,
  mesmerProfiledInstrument
} from '#gw2/professions/mesmer/specializations/troubadour/profiles.js';

/** Profile instrument data on demand; selecting content has no runtime initialization dependency. */
export function mesmerInstruments(context: MesmerRuntime) {
  return context.profession.specialization.kind === 'Troubadour'
    ? Object.fromEntries(
        Object.entries(MESMER_TROUBADOUR_INSTRUMENTS).map(([skillId, instrument]) => [
          Number(skillId),
          mesmerProfiledInstrument(context, instrument, TROUBADOUR_INSTRUMENT_PROFILE_IDS[Number(skillId)])
        ])
      )
    : {};
}
