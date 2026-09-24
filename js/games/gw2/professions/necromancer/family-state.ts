import { cappedResource } from '#gw2/platform/combat/resources/pool.js';
import {
  composePublicStateProjections,
  flattenProfessionState,
  projectPublicProfessionState
} from '#gw2/platform/engine/profession/state.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import type {
  ProfessionStateSnapshotEmissionContext,
  StateSnapshotEmissionOptions
} from '#gw2/platform/engine/events/state-snapshots.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { NECROMANCER_CORE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/necromancer/core/state.js';
import {
  HARBINGER_PUBLIC_STATE_PROJECTION,
  syncHarbingerState
} from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { RITUALIST_PUBLIC_STATE_PROJECTION } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { SCOURGE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/necromancer/specializations/scourge/state.js';
import type {
  NecromancerSchedulerContext,
  NecromancerPlanningStateProjectionOptions,
  NecromancerState
} from '#gw2/professions/necromancer/types.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';

/** Resource observations carry only their pool, so they cannot publish unrelated cast state. */
export function emitNecromancerLifeForce(context: NecromancerSchedulerContext, at: number, reason: string): void {
  context.emit({
    type: 'necromancer.life-force',
    at,
    source: 'necromancer',
    sourceId: 'necromancer.life-force',
    actorType: 'player',
    reason,
    state: { lifeForce: { ...professionCoreState(context).lifeForce } }
  });
}

/** Normalize a shallow candidate; emission and public projection detach only the state they retain. */
function flattenNecromancerState(state: unknown): NecromancerState {
  const flattened = flattenProfessionState<NecromancerState>(state);
  // Reporting clamps a detached pool without rewriting the live resource or its accrual anchor.
  flattened.lifeForce = {
    ...flattened.lifeForce,
    value: cappedResource(flattened.lifeForce.value, flattened.lifeForce.maximum)
  };
  if (Object.hasOwn(flattened, 'blightExpiries')) syncHarbingerState(flattened);
  return flattened;
}

/** Emits a synchronized Necromancer resource snapshot with shared deduplication. */
export function emitNecromancerStateSnapshot(
  context: ProfessionStateSnapshotEmissionContext,
  at: number,
  reason: string,
  options?: StateSnapshotEmissionOptions
): SimulationEvent | null {
  return emitStateSnapshot(
    context,
    'necromancer',
    at,
    reason,
    flattenNecromancerState(context.state.profession),
    options
  );
}

// Compose public metadata once; runtime initialization and resolver ownership stay with each slice.
const NECROMANCER_PUBLIC_STATE_PROJECTION = composePublicStateProjections([
  NECROMANCER_CORE_PUBLIC_STATE_PROJECTION,
  SCOURGE_PUBLIC_STATE_PROJECTION,
  HARBINGER_PUBLIC_STATE_PROJECTION,
  RITUALIST_PUBLIC_STATE_PROJECTION
]);

export const NECROMANCER_PUBLIC_END_STATE_KEYS = NECROMANCER_PUBLIC_STATE_PROJECTION.keys;

/** Project the scheduler's resource state after timestamped resolver gains have been replayed. */
export function projectNecromancerPlanningState({
  schedulerState
}: NecromancerPlanningStateProjectionOptions): Record<string, unknown> {
  const state = flattenNecromancerState(schedulerState.profession);
  return projectPublicProfessionState(
    state,
    NECROMANCER_PUBLIC_END_STATE_KEYS,
    NECROMANCER_PUBLIC_STATE_PROJECTION.defaults
  );
}
