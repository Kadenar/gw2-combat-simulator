import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { MesmerCriticalTraitDispatcher } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerDuelingCriticalContext } from '#gw2/professions/mesmer/core/traits/behavior.js';
import { triggerMesmerCriticalTraits } from '#gw2/professions/mesmer/core/traits/behavior.js';

/**
 * Keeps critical-candidate timing in the illusion subsystem while the trait
 * dispatcher materializes Dueling effects in their required order.
 */
export function createCriticalTraitDispatcher({
  state
}: MesmerDuelingCriticalContext): Readonly<MesmerCriticalTraitDispatcher> {
  const traitContext = { state };

  return Object.freeze({
    process(event: SimulationEvent, chance: number): void {
      triggerMesmerCriticalTraits(traitContext, event, chance);
    }
  });
}
