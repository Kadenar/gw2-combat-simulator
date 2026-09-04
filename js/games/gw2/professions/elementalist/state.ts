/**
 * Elementalist end-state boundary.
 *
 * Collects the state keys each module declares public and projects the flattened
 * core+specialization runtime state into the stable record that simulation results
 * expose, so the shape a consumer sees does not change with the equipped elite spec.
 */
import { projectPublicProfessionState, snapshotProfessionState } from '#gw2/platform/engine/profession/state.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import { ELEMENTALIST_CORE_PUBLIC_END_STATE_KEYS } from '#gw2/professions/elementalist/core/state.js';
import {
  CATALYST_PUBLIC_END_STATE_KEYS,
  CATALYST_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import {
  EVOKER_PUBLIC_END_STATE_KEYS,
  EVOKER_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '#gw2/professions/elementalist/specializations/evoker/state.js';
import {
  WEAVER_PUBLIC_END_STATE_KEYS,
  WEAVER_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '#gw2/professions/elementalist/specializations/weaver/state.js';
import type { ElementalistEndStateProjectionOptions, ElementalistState } from '#gw2/professions/elementalist/types.js';

// The family boundary composes public state fragments declared by their semantic owners.
/** Every state field the Elementalist family publishes in simulation results. */
export const ELEMENTALIST_PUBLIC_END_STATE_KEYS = Object.freeze([
  ...ELEMENTALIST_CORE_PUBLIC_END_STATE_KEYS,
  ...WEAVER_PUBLIC_END_STATE_KEYS,
  ...CATALYST_PUBLIC_END_STATE_KEYS,
  ...EVOKER_PUBLIC_END_STATE_KEYS
] as const satisfies readonly (keyof ElementalistState)[]);

// Values reported for a specialization's keys when that specialization is not the one
// running, so the projected record keeps a constant shape across every build.
const ELEMENTALIST_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<ElementalistState>> = Object.freeze({
  ...WEAVER_PUBLIC_INACTIVE_STATE_DEFAULTS,
  ...CATALYST_PUBLIC_INACTIVE_STATE_DEFAULTS,
  ...EVOKER_PUBLIC_INACTIVE_STATE_DEFAULTS
});

/** Projects the family aggregate while preserving the established public result shape. */
export function projectElementalistEndState({
  schedulerState
}: ElementalistEndStateProjectionOptions): SchedulerRecord {
  const state = snapshotProfessionState<ElementalistState>(schedulerState.profession);
  return projectPublicProfessionState(
    state,
    ELEMENTALIST_PUBLIC_END_STATE_KEYS,
    ELEMENTALIST_PUBLIC_INACTIVE_STATE_DEFAULTS
  );
}
