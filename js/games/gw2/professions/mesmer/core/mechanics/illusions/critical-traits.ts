import type { MesmerDuelingCriticalContext } from '#gw2/professions/mesmer/core/traits/dueling.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { triggerMesmerCriticalTraits } from '#gw2/professions/mesmer/core/traits/index.js';
import type { MesmerCriticalTraitDispatcher } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';

/**
 * Keeps critical-candidate timing in the illusion subsystem while the trait
 * dispatcher materializes Dueling effects in their required order.
 */
export function createCriticalTraitDispatcher({
  state,
  traits,
  emitEvent,
  boonDuration,
  addTraitProc,
  balanceProfile
}: MesmerDuelingCriticalContext): Readonly<MesmerCriticalTraitDispatcher> {
  const traitContext = {
    state,
    traits,
    emitEvent,
    boonDuration,
    addTraitProc,
    balanceProfile
  };

  return Object.freeze({
    process(event: SimulationEvent, chance: number): void {
      triggerMesmerCriticalTraits(traitContext, event, chance);
    }
  });
}
