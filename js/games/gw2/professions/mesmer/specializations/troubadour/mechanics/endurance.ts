import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import {
  activeTroubadourInstrumentsAt,
  troubadourState
} from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import { symphonicResonanceEndurance } from '#gw2/professions/mesmer/specializations/troubadour/traits/performance.js';
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
