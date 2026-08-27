import { flattenProfessionState, projectPublicProfessionState } from '../../../platform/engine/profession/state.js';
import type { SchedulerRecord } from '../../../platform/engine/types.js';
import { GUARDIAN_CORE_PUBLIC_END_STATE_KEYS, GUARDIAN_CORE_RESOLVER_END_STATE_KEYS } from './core/state.js';
import {
  DRAGONHUNTER_PUBLIC_END_STATE_DEFAULTS,
  DRAGONHUNTER_PUBLIC_END_STATE_KEYS,
  DRAGONHUNTER_RESOLVER_END_STATE_KEYS
} from './specializations/dragonhunter/state.js';
import {
  FIREBRAND_PUBLIC_END_STATE_DEFAULTS,
  FIREBRAND_PUBLIC_END_STATE_KEYS,
  FIREBRAND_RESOLVER_END_STATE_KEYS
} from './specializations/firebrand/state.js';
import {
  LUMINARY_PUBLIC_END_STATE_DEFAULTS,
  LUMINARY_PUBLIC_END_STATE_KEYS,
  LUMINARY_RESOLVER_END_STATE_KEYS
} from './specializations/luminary/state.js';
import {
  WILLBENDER_PUBLIC_END_STATE_DEFAULTS,
  WILLBENDER_PUBLIC_END_STATE_KEYS,
  WILLBENDER_RESOLVER_END_STATE_KEYS
} from './specializations/willbender/state.js';
import type { GuardianEndStateProjectionOptions, GuardianState } from './types.js';

const PUBLIC_STATE_SLICES = Object.freeze([
  GUARDIAN_CORE_PUBLIC_END_STATE_KEYS,
  DRAGONHUNTER_PUBLIC_END_STATE_KEYS,
  WILLBENDER_PUBLIC_END_STATE_KEYS,
  FIREBRAND_PUBLIC_END_STATE_KEYS,
  LUMINARY_PUBLIC_END_STATE_KEYS
]);

const RESOLVER_STATE_SLICES = Object.freeze([
  GUARDIAN_CORE_RESOLVER_END_STATE_KEYS,
  DRAGONHUNTER_RESOLVER_END_STATE_KEYS,
  WILLBENDER_RESOLVER_END_STATE_KEYS,
  FIREBRAND_RESOLVER_END_STATE_KEYS,
  LUMINARY_RESOLVER_END_STATE_KEYS
]);

const GUARDIAN_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<GuardianState>> = Object.freeze({
  ...DRAGONHUNTER_PUBLIC_END_STATE_DEFAULTS,
  ...WILLBENDER_PUBLIC_END_STATE_DEFAULTS,
  ...FIREBRAND_PUBLIC_END_STATE_DEFAULTS,
  ...LUMINARY_PUBLIC_END_STATE_DEFAULTS
});

/** Aggregates Core and active-specialization state into the stable Guardian snapshot contract. */
export function snapshotGuardianState(state: unknown): GuardianState {
  return structuredClone(flattenProfessionState(state)) as unknown as GuardianState;
}

/** Public compatibility keys are composed from manifests owned by each Guardian vertical slice. */
export const GUARDIAN_PUBLIC_END_STATE_KEYS: readonly (keyof GuardianState)[] = Object.freeze(
  PUBLIC_STATE_SLICES.flatMap((keys) => keys) as (keyof GuardianState)[]
);

const GUARDIAN_RESOLVER_END_STATE_KEYS: readonly (keyof GuardianState)[] = Object.freeze(
  RESOLVER_STATE_SLICES.flatMap((keys) => keys) as (keyof GuardianState)[]
);

/** Projects resolver-authoritative fields without making Core enumerate elite state. */
export function projectGuardianEndState({
  schedulerState,
  resolverState
}: GuardianEndStateProjectionOptions): SchedulerRecord {
  const state = snapshotGuardianState(schedulerState.profession);
  const resolver = flattenProfessionState(resolverState || {});
  const mutableState = state as unknown as SchedulerRecord;

  for (const key of GUARDIAN_RESOLVER_END_STATE_KEYS) {
    if (Object.hasOwn(resolver, key)) mutableState[key] = resolver[key];
  }

  return projectPublicProfessionState(state, GUARDIAN_PUBLIC_END_STATE_KEYS, GUARDIAN_PUBLIC_INACTIVE_STATE_DEFAULTS);
}
