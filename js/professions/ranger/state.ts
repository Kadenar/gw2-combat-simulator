import { flattenProfessionState } from '../../platform/engine/profession/state.js';
import { RANGER_CORE_PUBLIC_END_STATE_KEYS } from './core/state.js';
import { DRUID_PUBLIC_END_STATE_KEYS, DRUID_PUBLIC_INACTIVE_STATE_DEFAULTS } from './specializations/druid/state.js';
import {
  GALESHOT_PUBLIC_END_STATE_KEYS,
  GALESHOT_PUBLIC_INACTIVE_STATE_DEFAULTS
} from './specializations/galeshot/state.js';
import {
  SOULBEAST_PUBLIC_END_STATE_KEYS,
  SOULBEAST_PUBLIC_INACTIVE_STATE_DEFAULTS
} from './specializations/soulbeast/state.js';
import {
  UNTAMED_PUBLIC_END_STATE_KEYS,
  UNTAMED_PUBLIC_INACTIVE_STATE_DEFAULTS,
  UNTAMED_RESOLVER_END_STATE_KEYS
} from './specializations/untamed/state.js';
import type { RangerEndStateProjectionOptions, RangerState } from './types.js';

/** Aggregates Core and active-specialization state at the Ranger family boundary. */
export function snapshotRangerState(state: unknown): RangerState {
  return structuredClone(flattenProfessionState(state)) as unknown as RangerState;
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
export function projectRangerEndState({
  schedulerState,
  resolverState
}: RangerEndStateProjectionOptions): Record<string, unknown> {
  const state = snapshotRangerState(schedulerState.profession);
  const resolver = flattenProfessionState(resolverState || {});
  // Ferocious Symbiosis advances from resolved player/pet hits, so its resolver
  // values supersede the scheduler copy in the public insertion-aware state.
  for (const key of UNTAMED_RESOLVER_END_STATE_KEYS) {
    if (Object.hasOwn(resolver, key)) state[key] = resolver[key] as never;
  }

  return Object.fromEntries(
    RANGER_PUBLIC_END_STATE_KEYS.map((key) => [
      key,
      structuredClone(state[key] ?? RANGER_PUBLIC_INACTIVE_STATE_DEFAULTS[key])
    ])
  );
}
