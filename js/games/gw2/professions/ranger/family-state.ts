import type { Gw2PlanningStateInput } from '#gw2/platform/simulation/types.js';
import type { RangerRuntimeState } from '#gw2/professions/ranger/types.js';
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
import type { RangerState } from '#gw2/professions/ranger/types.js';

// Compose public metadata once; runtime initialization and resolver ownership stay with each slice.
const RANGER_PUBLIC_STATE_PROJECTION = composePublicStateProjections([
  RANGER_CORE_PUBLIC_STATE_PROJECTION,
  DRUID_PUBLIC_STATE_PROJECTION,
  SOULBEAST_PUBLIC_STATE_PROJECTION,
  UNTAMED_PUBLIC_STATE_PROJECTION,
  GALESHOT_PUBLIC_STATE_PROJECTION
]);

export const RANGER_PUBLIC_END_STATE_KEYS = RANGER_PUBLIC_STATE_PROJECTION.keys;

/** Publish detached state, including Druid's clock, so UI reads cannot mutate runtime resources. */
export function projectRangerPlanningState({
  profession
}: Gw2PlanningStateInput<RangerRuntimeState>): Record<string, unknown> {
  const state = snapshotProfessionState<RangerState>(profession);
  return projectPublicProfessionState(state, RANGER_PUBLIC_END_STATE_KEYS, RANGER_PUBLIC_STATE_PROJECTION.defaults);
}
