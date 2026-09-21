import {
  composePublicStateProjections,
  professionCoreState,
  projectPublicProfessionState,
  restoreFlatProfessionState,
  snapshotProfessionState
} from '#gw2/platform/engine/profession/state.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import type {
  ProfessionStateSnapshotEmissionContext,
  StateSnapshotEmissionOptions
} from '#gw2/platform/engine/events/state-snapshots.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { scrapperState } from '#gw2/professions/engineer/specializations/scrapper/state.js';
import { ENGINEER_CORE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/engineer/core/state.js';
import { AMALGAM_PUBLIC_STATE_PROJECTION } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import {
  HOLOSMITH_PUBLIC_STATE_PROJECTION,
  HOLOSMITH_RESOLVER_STATE_KEYS,
  holosmithState
} from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { MECHANIST_PUBLIC_STATE_PROJECTION } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import type {
  EngineerPlanningStateProjectionOptions,
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerState
} from '#gw2/professions/engineer/types.js';

/** Aggregates Core and active-specialization state at the Engineer family boundary. */
export function snapshotEngineerState(state: unknown): EngineerState {
  return snapshotProfessionState<EngineerState>(state);
}

/** Emits a complete Engineer snapshot with the family identity owned here. */
export function emitEngineerStateSnapshot(
  context: ProfessionStateSnapshotEmissionContext,
  at: number,
  reason: string,
  options?: StateSnapshotEmissionOptions
): SimulationEvent | null {
  return emitStateSnapshot(context, 'engineer', at, reason, snapshotEngineerState(context.state.profession), options);
}

// Compose public metadata once; runtime initialization and resolver ownership stay with each slice.
const ENGINEER_PUBLIC_STATE_PROJECTION = composePublicStateProjections([
  ENGINEER_CORE_PUBLIC_STATE_PROJECTION,
  HOLOSMITH_PUBLIC_STATE_PROJECTION,
  MECHANIST_PUBLIC_STATE_PROJECTION,
  AMALGAM_PUBLIC_STATE_PROJECTION
]);

export const ENGINEER_PUBLIC_END_STATE_KEYS = ENGINEER_PUBLIC_STATE_PROJECTION.keys;

/** Projects the family aggregate while preserving the existing public shape. */
export function projectEngineerPlanningState({
  schedulerState
}: EngineerPlanningStateProjectionOptions): Pick<EngineerState, (typeof ENGINEER_PUBLIC_END_STATE_KEYS)[number]> {
  const state = snapshotEngineerState(schedulerState.profession);
  // Scheduler predictions remain independent from combat-time charge consumption.
  return projectPublicProfessionState(state, ENGINEER_PUBLIC_END_STATE_KEYS, ENGINEER_PUBLIC_STATE_PROJECTION.defaults);
}

/** Routes a scheduler snapshot back to the Core and active-specialization owners. */
export function handleEngineerState(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const core = professionCoreState(context);
  const specialization = context.profession.specialization.state;
  // Resolver trait proc windows advance independently and must not be rolled back by scheduler snapshots.
  const preserved = {
    traitProcReadyAt: core.traitProcReadyAt || {}
  };
  const lens =
    context.profession.specialization.kind === 'Holosmith'
      ? Object.fromEntries(HOLOSMITH_RESOLVER_STATE_KEYS.map((key) => [key, holosmithState.from(context)[key]]))
      : context.profession.specialization.kind === 'Scrapper'
        ? // Predicted Whirl claims cannot pre-spend or rewind the resolver's independent cooldown.
          { kineticAcceleratorsWhirlReadyAt: scrapperState.from(context).kineticAcceleratorsWhirlReadyAt }
        : {};
  restoreFlatProfessionState(core, specialization, event.state);

  Object.assign(core, preserved);
  Object.assign(specialization, lens);
}
