import type { SchedulerState } from '#gw2/platform/engine/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import type {
  MesmerAddTraitProc,
  MesmerConfig,
  MesmerEmitDerivedEvent,
  MesmerRuntime
} from '#gw2/professions/mesmer/types.js';
import { triggerMesmerCriticalTraits } from '#gw2/professions/mesmer/core/traits/index.js';
import type {
  MesmerExpectedProcCandidate,
  MesmerExpectedProcTracker
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/state/types.js';

interface ExpectedProcTrackerOptions {
  readonly state: SchedulerState<MesmerRuntimeState>;
  readonly config: MesmerConfig;
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
export function createExpectedProcTracker({
  state,
  config,
  traits,
  criticalChance,
  emitEvent,
  boonDuration,
  addTraitProc,
  balanceProfile
}: ExpectedProcTrackerOptions): Readonly<MesmerExpectedProcTracker> {
  const traitContext = {
    state,
    traits,
    stochastic: config.randomness?.mode === 'stochastic',
    emitEvent,
    boonDuration,
    addTraitProc,
    balanceProfile
  };

  return Object.freeze({
    process(candidate: MesmerExpectedProcCandidate): void {
      const chance = Number(criticalChance(candidate.event) || 0);
      triggerMesmerCriticalTraits(traitContext, candidate.event, chance);
    }
  });
}
