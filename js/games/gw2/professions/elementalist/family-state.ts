import type { Gw2PlanningStateInput } from '#gw2/platform/simulation/types.js';
import type { ElementalistRuntimeState } from '#gw2/professions/elementalist/types.js';
/**
 * Elementalist end-state boundary.
 *
 * Collects the state keys each module declares public and projects the flattened
 * core+specialization runtime state into the stable record that simulation results
 * expose, so the shape a consumer sees does not change with the equipped elite spec.
 */
import {
  composePublicStateProjections,
  projectPublicProfessionState,
  snapshotProfessionState
} from '#gw2/platform/engine/profession/state.js';
import { ELEMENTALIST_CORE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/elementalist/core/state.js';
import { CATALYST_PUBLIC_STATE_PROJECTION } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { EVOKER_PUBLIC_STATE_PROJECTION } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { WEAVER_PUBLIC_STATE_PROJECTION } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import type { ElementalistState } from '#gw2/professions/elementalist/types.js';

// Compose public metadata once; runtime initialization and resolver ownership stay with each slice.
const ELEMENTALIST_PUBLIC_STATE_PROJECTION = composePublicStateProjections([
  ELEMENTALIST_CORE_PUBLIC_STATE_PROJECTION,
  WEAVER_PUBLIC_STATE_PROJECTION,
  CATALYST_PUBLIC_STATE_PROJECTION,
  EVOKER_PUBLIC_STATE_PROJECTION
]);

/** Every state field the Elementalist family publishes in simulation results. */
export const ELEMENTALIST_PUBLIC_END_STATE_KEYS = ELEMENTALIST_PUBLIC_STATE_PROJECTION.keys;

/** Projects the family aggregate while preserving the established public result shape. */
export function projectElementalistPlanningState({
  profession
}: Gw2PlanningStateInput<ElementalistRuntimeState>): Pick<
  ElementalistState,
  (typeof ELEMENTALIST_PUBLIC_END_STATE_KEYS)[number]
> {
  const state = snapshotProfessionState<ElementalistState>(profession);
  return projectPublicProfessionState(
    state,
    ELEMENTALIST_PUBLIC_END_STATE_KEYS,
    ELEMENTALIST_PUBLIC_STATE_PROJECTION.defaults
  );
}
