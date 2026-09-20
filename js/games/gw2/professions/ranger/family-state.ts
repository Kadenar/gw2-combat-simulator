import { projectPublicProfessionState, snapshotProfessionState } from '#gw2/platform/engine/profession/state.js';
import { RANGER_CORE_PUBLIC_END_STATE_KEYS } from '#gw2/professions/ranger/core/state.js';
import {
  DRUID_PUBLIC_END_STATE_KEYS,
  DRUID_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '#gw2/professions/ranger/specializations/druid/state.js';
import {
  GALESHOT_PUBLIC_END_STATE_KEYS,
  GALESHOT_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '#gw2/professions/ranger/specializations/galeshot/state.js';
import {
  SOULBEAST_PUBLIC_END_STATE_KEYS,
  SOULBEAST_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import {
  UNTAMED_PUBLIC_END_STATE_KEYS,
  UNTAMED_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '#gw2/professions/ranger/specializations/untamed/state.js';
import type { RangerPlanningStateProjectionOptions, RangerState } from '#gw2/professions/ranger/types.js';

/** Aggregates Core and active-specialization state at the Ranger family boundary. */
export function snapshotRangerState(state: unknown): RangerState {
  return snapshotProfessionState<RangerState>(state);
}

// The family boundary composes the public fragments declared by their semantic owners.
export const RANGER_PUBLIC_END_STATE_KEYS = Object.freeze([
  ...RANGER_CORE_PUBLIC_END_STATE_KEYS,
  ...DRUID_PUBLIC_END_STATE_KEYS,
  ...SOULBEAST_PUBLIC_END_STATE_KEYS,
  ...UNTAMED_PUBLIC_END_STATE_KEYS,
  ...GALESHOT_PUBLIC_END_STATE_KEYS
] as const satisfies readonly (keyof RangerState)[]);

const RANGER_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<RangerState>> = Object.freeze({
  ...DRUID_PUBLIC_INACTIVE_STATE_DEFAULTS,
  ...SOULBEAST_PUBLIC_INACTIVE_STATE_DEFAULTS,
  ...UNTAMED_PUBLIC_INACTIVE_STATE_DEFAULTS,
  ...GALESHOT_PUBLIC_INACTIVE_STATE_DEFAULTS
});

/** Projects the family aggregate while preserving the existing public shape. */
export function projectRangerPlanningState({
  schedulerState
}: RangerPlanningStateProjectionOptions): Record<string, unknown> {
  const state = snapshotRangerState(schedulerState.profession);
  // Landed-hit consumption belongs only to the separately observed combat state.
  return projectPublicProfessionState(state, RANGER_PUBLIC_END_STATE_KEYS, RANGER_PUBLIC_INACTIVE_STATE_DEFAULTS);
}
