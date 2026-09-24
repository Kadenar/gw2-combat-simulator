import type { SchedulerState } from '#gw2/platform/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type {
  MesmerAddTraitProc,
  MesmerEmitDerivedEvent,
  MesmerRuntime,
  MesmerRuntimeState
} from '#gw2/professions/mesmer/types.js';
import { triggerMesmerCriticalTraits } from '#gw2/professions/mesmer/core/traits/index.js';
import type { MesmerCriticalTraitDispatcher } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';

interface CriticalTraitDispatcherOptions {
  readonly state: SchedulerState<MesmerRuntimeState>;
  readonly traits: ReadonlySet<number>;
  readonly criticalChance: (event: SimulationEvent) => number;
  readonly emitEvent: MesmerEmitDerivedEvent;
  readonly boonDuration: (boon: string, baseDuration: number) => number;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly balanceProfile: MesmerRuntime['balanceProfile'];
}

/**
 * Keeps critical-candidate timing in the illusion subsystem while the trait
 * dispatcher materializes Dueling effects in their required order.
 */
export function createCriticalTraitDispatcher({
  state,
  traits,
  criticalChance,
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
    process(event: SimulationEvent): void {
      const chance = Number(criticalChance(event) || 0);
      triggerMesmerCriticalTraits(traitContext, event, chance);
    }
  });
}
