import type { Gw2PlanningStateInput } from '#gw2/platform/simulation/types.js';
import type { EngineerRuntimeState } from '#gw2/professions/engineer/types.js';
import {
  composePublicStateProjections,
  projectPublicProfessionState,
  snapshotProfessionState
} from '#gw2/platform/engine/profession/state.js';
import { ENGINEER_CORE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/engineer/core/state.js';
import { AMALGAM_PUBLIC_STATE_PROJECTION } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import { HOLOSMITH_PUBLIC_STATE_PROJECTION } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { MECHANIST_PUBLIC_STATE_PROJECTION } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import type { EngineerState } from '#gw2/professions/engineer/types.js';

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
  profession
}: Gw2PlanningStateInput<EngineerRuntimeState>): Pick<EngineerState, (typeof ENGINEER_PUBLIC_END_STATE_KEYS)[number]> {
  const state = snapshotProfessionState<EngineerState>(profession);
  return projectPublicProfessionState(state, ENGINEER_PUBLIC_END_STATE_KEYS, ENGINEER_PUBLIC_STATE_PROJECTION.defaults);
}
