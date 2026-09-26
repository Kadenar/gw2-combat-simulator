import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { MesmerAddTraitProc, MesmerEmitDerivedEvent, MesmerMechanics } from '#gw2/professions/mesmer/types.js';
import { triggerMesmerCriticalTraits } from '#gw2/professions/mesmer/core/traits/index.js';
import type { MesmerCriticalTraitDispatcher } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';

interface CriticalTraitDispatcherOptions {
  readonly state: MesmerRuntime;
  readonly traits: ReadonlySet<number>;
  readonly emitEvent: MesmerEmitDerivedEvent;
  readonly boonDuration: (boon: string, baseDuration: number) => number;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly balanceProfile: MesmerMechanics['balanceProfile'];
}

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
}: CriticalTraitDispatcherOptions): Readonly<MesmerCriticalTraitDispatcher> {
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
