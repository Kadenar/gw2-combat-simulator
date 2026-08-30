import {
  flattenProfessionState,
  professionCoreState,
  projectPublicProfessionState
} from '../../../../platform/engine/profession/state.js';
import { REVENANT_CORE_PUBLIC_END_STATE_KEYS } from '../core/state.js';
import {
  CONDUIT_PUBLIC_END_STATE_KEYS,
  CONDUIT_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '../specializations/conduit/state.js';
import {
  HERALD_PUBLIC_END_STATE_KEYS,
  HERALD_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '../specializations/herald/state.js';
import {
  RENEGADE_PUBLIC_END_STATE_KEYS,
  RENEGADE_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '../specializations/renegade/state.js';
import {
  VINDICATOR_PUBLIC_END_STATE_KEYS,
  VINDICATOR_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '../specializations/vindicator/state.js';
import type {
  RenegadeState,
  RevenantResolverContext,
  RevenantResolverEvent,
  RevenantRuntimeState,
  RevenantState
} from '../types.js';
import type { SchedulerState } from '../../../../platform/engine/types.js';

/** Flattens the family runtime state for stable scheduler and resolver handoff. */
export function snapshotRevenantState(state: unknown): RevenantState {
  return structuredClone(flattenProfessionState(state)) as unknown as RevenantState;
}

export const REVENANT_PUBLIC_END_STATE_KEYS: readonly (keyof RevenantState)[] = Object.freeze([
  ...REVENANT_CORE_PUBLIC_END_STATE_KEYS,
  ...HERALD_PUBLIC_END_STATE_KEYS,
  ...RENEGADE_PUBLIC_END_STATE_KEYS,
  ...VINDICATOR_PUBLIC_END_STATE_KEYS,
  ...CONDUIT_PUBLIC_END_STATE_KEYS
]);

const REVENANT_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<RevenantState>> = Object.freeze({
  ...HERALD_PUBLIC_INACTIVE_STATE_DEFAULTS,
  ...RENEGADE_PUBLIC_INACTIVE_STATE_DEFAULTS,
  ...VINDICATOR_PUBLIC_INACTIVE_STATE_DEFAULTS,
  ...CONDUIT_PUBLIC_INACTIVE_STATE_DEFAULTS
});

/** Projects the public Revenant state while supplying stable defaults for inactive elite specializations. */
export function projectRevenantEndState({
  schedulerState
}: {
  schedulerState: SchedulerState<RevenantRuntimeState>;
}): Partial<RevenantState> {
  const state = snapshotRevenantState(schedulerState.profession);
  return projectPublicProfessionState(state, REVENANT_PUBLIC_END_STATE_KEYS, REVENANT_PUBLIC_INACTIVE_STATE_DEFAULTS);
}

/** Routes flat state snapshots back to their owning runtime slice without overwriting resolver-only proc clocks. */
export function handleRevenantState(context: RevenantResolverContext, event: RevenantResolverEvent): void {
  const core = professionCoreState(context);
  const specialization = context.profession.specialization.state;
  const preservedCoreTraitProcReadyAt = core.traitProcReadyAt || {};
  const preservedSoulcleaveReadyAt =
    context.profession.specialization.kind === 'Renegade'
      ? (specialization as RenegadeState).soulcleaveReadyAt
      : undefined;
  for (const [key, value] of Object.entries(event.state || {})) {
    const owner = Object.hasOwn(specialization, key) ? specialization : core;
    (owner as Record<string, unknown>)[key] = structuredClone(value);
  }

  core.traitProcReadyAt = preservedCoreTraitProcReadyAt;
  if (context.profession.specialization.kind === 'Renegade') {
    (specialization as RenegadeState).soulcleaveReadyAt = Number(preservedSoulcleaveReadyAt || 0);
  }
}
