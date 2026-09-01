import {
  professionCoreState,
  projectPublicProfessionState,
  restoreFlatProfessionState,
  snapshotProfessionState
} from '#gw2/platform/engine/profession/state.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import type {
  ProfessionStateSnapshotEmissionContext,
  StateSnapshotEmissionOptions
} from '#gw2/platform/engine/events/state-snapshots.js';
import { REVENANT_CORE_PUBLIC_END_STATE_KEYS } from '#gw2/content/professions/revenant/core/state.js';
import {
  CONDUIT_PUBLIC_END_STATE_KEYS,
  CONDUIT_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '#gw2/content/professions/revenant/specializations/conduit/state.js';
import {
  RENEGADE_PUBLIC_END_STATE_KEYS,
  RENEGADE_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '#gw2/content/professions/revenant/specializations/renegade/state.js';
import {
  VINDICATOR_PUBLIC_END_STATE_KEYS,
  VINDICATOR_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '#gw2/content/professions/revenant/specializations/vindicator/state.js';
import type {
  RenegadeState,
  RevenantResolverContext,
  RevenantResolverEvent,
  RevenantRuntimeState,
  RevenantState
} from '#gw2/content/professions/revenant/types.js';
import type { SchedulerState, SimulationEvent } from '#gw2/platform/engine/types.js';

/** Flattens the family runtime state for stable scheduler and resolver handoff. */
export function snapshotRevenantState(state: unknown): RevenantState {
  return snapshotProfessionState<RevenantState>(state);
}

/** Emits a complete Revenant snapshot with the family identity owned here. */
export function emitRevenantStateSnapshot(
  context: ProfessionStateSnapshotEmissionContext,
  at: number,
  reason: string,
  options?: StateSnapshotEmissionOptions
): SimulationEvent | null {
  return emitStateSnapshot(context, 'revenant', at, reason, snapshotRevenantState(context.state.profession), options);
}

export const REVENANT_PUBLIC_END_STATE_KEYS: readonly (keyof RevenantState)[] = Object.freeze([
  ...REVENANT_CORE_PUBLIC_END_STATE_KEYS,
  ...RENEGADE_PUBLIC_END_STATE_KEYS,
  ...VINDICATOR_PUBLIC_END_STATE_KEYS,
  ...CONDUIT_PUBLIC_END_STATE_KEYS
]);

const REVENANT_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<RevenantState>> = Object.freeze({
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
  restoreFlatProfessionState(core, specialization, event.state);

  core.traitProcReadyAt = preservedCoreTraitProcReadyAt;
  if (context.profession.specialization.kind === 'Renegade') {
    (specialization as RenegadeState).soulcleaveReadyAt = Number(preservedSoulcleaveReadyAt || 0);
  }
}
