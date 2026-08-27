import { flattenProfessionState, projectPublicProfessionState } from '../../../platform/engine/profession/state.js';
import type { SchedulerRecord } from '../../../platform/engine/types.js';
import { ELEMENTALIST_CORE_PUBLIC_END_STATE_KEYS } from './core/state.js';
import {
  CATALYST_PUBLIC_END_STATE_KEYS,
  CATALYST_PUBLIC_INACTIVE_STATE_DEFAULTS
} from './specializations/catalyst/state.js';
import { EVOKER_PUBLIC_END_STATE_KEYS, EVOKER_PUBLIC_INACTIVE_STATE_DEFAULTS } from './specializations/evoker/state.js';
import {
  TEMPEST_PUBLIC_END_STATE_KEYS,
  TEMPEST_PUBLIC_INACTIVE_STATE_DEFAULTS
} from './specializations/tempest/state.js';
import { WEAVER_PUBLIC_END_STATE_KEYS, WEAVER_PUBLIC_INACTIVE_STATE_DEFAULTS } from './specializations/weaver/state.js';
import type { ElementalistEndStateProjectionOptions, ElementalistState } from './types.js';

// The family boundary composes public state fragments declared by their semantic owners.
export const ELEMENTALIST_PUBLIC_END_STATE_KEYS = Object.freeze([
  ...ELEMENTALIST_CORE_PUBLIC_END_STATE_KEYS,
  ...TEMPEST_PUBLIC_END_STATE_KEYS,
  ...WEAVER_PUBLIC_END_STATE_KEYS,
  ...CATALYST_PUBLIC_END_STATE_KEYS,
  ...EVOKER_PUBLIC_END_STATE_KEYS
] as const satisfies readonly (keyof ElementalistState)[]);

const ELEMENTALIST_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<ElementalistState>> = Object.freeze({
  ...TEMPEST_PUBLIC_INACTIVE_STATE_DEFAULTS,
  ...WEAVER_PUBLIC_INACTIVE_STATE_DEFAULTS,
  ...CATALYST_PUBLIC_INACTIVE_STATE_DEFAULTS,
  ...EVOKER_PUBLIC_INACTIVE_STATE_DEFAULTS
});

/** Projects the family aggregate while preserving the established public result shape. */
export function projectElementalistEndState({
  schedulerState
}: ElementalistEndStateProjectionOptions): SchedulerRecord {
  const state = flattenProfessionState(schedulerState.profession) as unknown as ElementalistState;
  return projectPublicProfessionState(
    state,
    ELEMENTALIST_PUBLIC_END_STATE_KEYS,
    ELEMENTALIST_PUBLIC_INACTIVE_STATE_DEFAULTS
  );
}
