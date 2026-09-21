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
  const state = snapshotProfessionState<RangerState>(schedulerState.profession);
  // Derive display values on the detached projection, never as aliases on live state.
  if (state.astralClock) {
    state.astralForce = state.astralClock.value;
    state.maximumAstralForce = state.astralClock.maximum;
  }

  // Landed-hit consumption belongs only to the separately observed combat state.
  return projectPublicProfessionState(state, RANGER_PUBLIC_END_STATE_KEYS, RANGER_PUBLIC_STATE_PROJECTION.defaults);
}
