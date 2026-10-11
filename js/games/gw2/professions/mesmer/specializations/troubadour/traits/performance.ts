import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Flute's intrinsic endurance contribution retains its playing-window gate without current trait selection. */
export function symphonicResonanceEndurance(context: MesmerRuntime, flutePlaying: boolean): number {
  return flutePlaying
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.SYMPHONIC_RESONANCE),
        'enduranceRegenerationMultiplier'
      ) - 1
    : 0;
}
