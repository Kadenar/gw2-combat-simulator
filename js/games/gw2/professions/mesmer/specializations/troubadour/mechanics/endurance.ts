import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import {
  activeTroubadourInstrumentsAt,
  troubadourState
} from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Flute adds 25% to base recovery only during its committed playing window, alongside Vigor's 50%. */
export const troubadourEndurance: EndurancePolicy<MesmerRuntime> = {
  state: (context) => troubadourState.from(context).endurance,
  maximum: () => 100,
  regenerationBoundaries: (context) =>
    context.facts
      .read()
      .filter((event) => event.type === 'mesmer.instrument')
      .filter((event) => event.instrument === 'Flute')
      .flatMap((event) => [event.at, Number(event.expiresAt)]),
  regenerationRate: (context, vigor, at) => {
    const flutePlaying = activeTroubadourInstrumentsAt(
      context.facts.read().filter((event) => event.type === 'mesmer.instrument'),
      at
    ).has('Flute');
    const fluteBonus = symphonicResonanceEndurance(context, flutePlaying);
    return 5 * Math.min(2, 1 + (vigor ? 0.5 : 0) + fluteBonus);
  }
};

/** Flute's intrinsic endurance contribution retains its playing-window gate without current trait selection. */
function symphonicResonanceEndurance(context: MesmerRuntime, flutePlaying: boolean): number {
  return flutePlaying
    ? balanceNumberFromContext(context, TRAIT.SYMPHONIC_RESONANCE, 'enduranceRegenerationMultiplier') - 1
    : 0;
}
