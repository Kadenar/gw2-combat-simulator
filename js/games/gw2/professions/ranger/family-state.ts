import {
  composePublicStateProjections,
  projectPublicProfessionState,
  snapshotProfessionState
} from '#gw2/platform/engine/profession/state.js';
import { RANGER_CORE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/ranger/core/state.js';
import { DRUID_PUBLIC_STATE_PROJECTION } from '#gw2/professions/ranger/specializations/druid/state.js';
import { GALESHOT_PUBLIC_STATE_PROJECTION } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import { SOULBEAST_PUBLIC_STATE_PROJECTION } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import { UNTAMED_PUBLIC_STATE_PROJECTION } from '#gw2/professions/ranger/specializations/untamed/state.js';
import type { RangerPlanningStateProjectionOptions, RangerState } from '#gw2/professions/ranger/types.js';

/** Aggregates Core and active-specialization state at the Ranger family boundary. */
export function snapshotRangerState(state: unknown): RangerState {
  return snapshotProfessionState<RangerState>(state);
}

// Compose public metadata once; runtime initialization and resolver ownership stay with each slice.
const RANGER_PUBLIC_STATE_PROJECTION = composePublicStateProjections([
  RANGER_CORE_PUBLIC_STATE_PROJECTION,
  DRUID_PUBLIC_STATE_PROJECTION,
  SOULBEAST_PUBLIC_STATE_PROJECTION,
  UNTAMED_PUBLIC_STATE_PROJECTION,
  GALESHOT_PUBLIC_STATE_PROJECTION
]);

export const RANGER_PUBLIC_END_STATE_KEYS = RANGER_PUBLIC_STATE_PROJECTION.keys;

/** Projects the family aggregate while preserving the existing public shape. */
export function projectRangerPlanningState({
  schedulerState
}: RangerPlanningStateProjectionOptions): Record<string, unknown> {
  const state = snapshotRangerState(schedulerState.profession);
  // Landed-hit consumption belongs only to the separately observed combat state.
  return projectPublicProfessionState(state, RANGER_PUBLIC_END_STATE_KEYS, RANGER_PUBLIC_STATE_PROJECTION.defaults);
}
