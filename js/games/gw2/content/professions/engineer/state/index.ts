import {
  flattenProfessionState,
  professionCoreState,
  projectPublicProfessionState
} from '../../../../platform/engine/profession/state.js';
import type { SchedulerRecord } from '../../../../platform/engine/types.js';
import { ENGINEER_CORE_PUBLIC_END_STATE_KEYS } from '../core/state.js';
import {
  AMALGAM_PUBLIC_END_STATE_KEYS,
  AMALGAM_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '../specializations/amalgam/state.js';
import {
  HOLOSMITH_PUBLIC_END_STATE_KEYS,
  HOLOSMITH_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '../specializations/holosmith/state.js';
import {
  MECHANIST_PUBLIC_END_STATE_KEYS,
  MECHANIST_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '../specializations/mechanist/state.js';
import type {
  EngineerEndStateProjectionOptions,
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerState
} from '../types.js';

/** Aggregates Core and active-specialization state at the Engineer family boundary. */
export function snapshotEngineerState(state: unknown): EngineerState {
  return structuredClone(flattenProfessionState(state)) as unknown as EngineerState;
}

// The family boundary composes the public fragments declared by their semantic owners.
export const ENGINEER_PUBLIC_END_STATE_KEYS = Object.freeze([
  ...ENGINEER_CORE_PUBLIC_END_STATE_KEYS,
  ...HOLOSMITH_PUBLIC_END_STATE_KEYS,
  ...MECHANIST_PUBLIC_END_STATE_KEYS,
  ...AMALGAM_PUBLIC_END_STATE_KEYS
] as const satisfies readonly (keyof EngineerState)[]);

const ENGINEER_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<EngineerState>> = Object.freeze({
  ...HOLOSMITH_PUBLIC_INACTIVE_STATE_DEFAULTS,
  ...MECHANIST_PUBLIC_INACTIVE_STATE_DEFAULTS,
  ...AMALGAM_PUBLIC_INACTIVE_STATE_DEFAULTS
});

/** Projects the family aggregate while preserving the existing public shape. */
export function projectEngineerEndState({ schedulerState }: EngineerEndStateProjectionOptions): SchedulerRecord {
  const state = snapshotEngineerState(schedulerState.profession);
  return projectPublicProfessionState(state, ENGINEER_PUBLIC_END_STATE_KEYS, ENGINEER_PUBLIC_INACTIVE_STATE_DEFAULTS);
}

/** Routes a scheduler snapshot back to the Core and active-specialization owners. */
export function handleEngineerState(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const core = professionCoreState(context);
  const specialization = context.profession.specialization.state;
  // Resolver trait proc windows advance independently and must not be rolled back by scheduler snapshots.
  const preserved = {
    traitProcReadyAt: core.traitProcReadyAt || {}
  };
  for (const [key, value] of Object.entries(event.state || {})) {
    const owner = Object.hasOwn(specialization, key) ? specialization : core;
    (owner as SchedulerRecord)[key] = structuredClone(value);
  }

  Object.assign(core, preserved);
}
