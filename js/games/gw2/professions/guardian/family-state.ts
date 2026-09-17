import {
  flattenProfessionState,
  projectPublicProfessionState,
  snapshotProfessionState
} from '#gw2/platform/engine/profession/state.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import {
  activeSymbolicAvengerExpirations,
  GUARDIAN_CORE_PUBLIC_END_STATE_KEYS,
  GUARDIAN_CORE_RESOLVER_END_STATE_KEYS
} from '#gw2/professions/guardian/core/state.js';
import {
  DRAGONHUNTER_PUBLIC_END_STATE_DEFAULTS,
  DRAGONHUNTER_PUBLIC_END_STATE_KEYS,
  DRAGONHUNTER_RESOLVER_END_STATE_KEYS
} from '#gw2/professions/guardian/specializations/dragonhunter/state.js';
import {
  FIREBRAND_PUBLIC_END_STATE_DEFAULTS,
  FIREBRAND_PUBLIC_END_STATE_KEYS,
  FIREBRAND_RESOLVER_END_STATE_KEYS
} from '#gw2/professions/guardian/specializations/firebrand/state.js';
import {
  LUMINARY_PUBLIC_END_STATE_DEFAULTS,
  LUMINARY_PUBLIC_END_STATE_KEYS,
  LUMINARY_RESOLVER_END_STATE_KEYS
} from '#gw2/professions/guardian/specializations/luminary/state.js';
import {
  WILLBENDER_PUBLIC_END_STATE_DEFAULTS,
  WILLBENDER_PUBLIC_END_STATE_KEYS,
  WILLBENDER_RESOLVER_END_STATE_KEYS
} from '#gw2/professions/guardian/specializations/willbender/state.js';
import type { GuardianEndStateProjectionOptions, GuardianState } from '#gw2/professions/guardian/types.js';

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

/** Derives compatibility counters from detached combat state at the snapshot's observation time. */
export function snapshotGuardianState(state: unknown, at: number): GuardianState {
  const snapshot = snapshotProfessionState<GuardianState>(state);
  snapshot.justiceArmed = Boolean(snapshot.justiceActiveArmed);
  snapshot.justiceBurns = Number(snapshot.justiceActiveBurns || 0) + Number(snapshot.justicePassiveBurns || 0);
  snapshot.symbolicAvengerExpirations = activeSymbolicAvengerExpirations(snapshot, at);
  snapshot.symbolicAvengerStacks = snapshot.symbolicAvengerExpirations.length;
  return snapshot;
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
  const state = flattenProfessionState<GuardianState>(schedulerState.profession);
  const resolver = flattenProfessionState(resolverState || {});
  const mutableState = state as unknown as SchedulerRecord;

  for (const key of GUARDIAN_RESOLVER_END_STATE_KEYS) {
    if (Object.hasOwn(resolver, key)) mutableState[key] = resolver[key];
  }

  // Derive mirrors only after resolver values win, including stacks expiring during a final wait.
  return projectPublicProfessionState(
    snapshotGuardianState(state, schedulerState.time),
    GUARDIAN_PUBLIC_END_STATE_KEYS,
    GUARDIAN_PUBLIC_INACTIVE_STATE_DEFAULTS
  );
}
