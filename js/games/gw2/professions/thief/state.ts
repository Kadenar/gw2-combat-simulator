import {
  professionCoreState,
  projectPublicProfessionState,
  flattenProfessionState,
  restoreFlatProfessionState
} from '#gw2/platform/engine/profession/state.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import type {
  ProfessionStateSnapshotEmissionContext,
  StateSnapshotEmissionOptions
} from '#gw2/platform/engine/events/state-snapshots.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import { snapshotThiefState, THIEF_CORE_PUBLIC_END_STATE_KEYS } from '#gw2/professions/thief/core/state.js';
export { snapshotThiefState } from '#gw2/professions/thief/core/state.js';
import {
  ANTIQUARY_INACTIVE_STATE_DEFAULTS,
  ANTIQUARY_PUBLIC_END_STATE_KEYS
} from '#gw2/professions/thief/specializations/antiquary/state.js';
import {
  DAREDEVIL_INACTIVE_STATE_DEFAULTS,
  DAREDEVIL_PUBLIC_END_STATE_KEYS
} from '#gw2/professions/thief/specializations/daredevil/state.js';
import {
  DEADEYE_INACTIVE_STATE_DEFAULTS,
  DEADEYE_PUBLIC_END_STATE_KEYS
} from '#gw2/professions/thief/specializations/deadeye/state.js';
import {
  SPECTER_INACTIVE_STATE_DEFAULTS,
  SPECTER_PUBLIC_END_STATE_KEYS
} from '#gw2/professions/thief/specializations/specter/state.js';
import type {
  ThiefEndStateProjectionOptions,
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefState
} from '#gw2/professions/thief/types.js';

// The family projector composes each independently owned state slice into the stable public end-state contract.
export const THIEF_PUBLIC_END_STATE_KEYS = Object.freeze([
  ...THIEF_CORE_PUBLIC_END_STATE_KEYS,
  ...DAREDEVIL_PUBLIC_END_STATE_KEYS,
  ...DEADEYE_PUBLIC_END_STATE_KEYS,
  ...SPECTER_PUBLIC_END_STATE_KEYS,
  ...ANTIQUARY_PUBLIC_END_STATE_KEYS,
  'holoUtilityCooldownReductionExpiresAt'
] as const);

const INACTIVE_STATE_DEFAULTS: Readonly<Partial<ThiefState>> = Object.freeze({
  ...DAREDEVIL_INACTIVE_STATE_DEFAULTS,
  ...DEADEYE_INACTIVE_STATE_DEFAULTS,
  ...SPECTER_INACTIVE_STATE_DEFAULTS,
  ...ANTIQUARY_INACTIVE_STATE_DEFAULTS
});

/** Emits a complete Thief snapshot while leaving generation reconciliation owner-local. */
export function emitThiefStateSnapshot(
  context: ProfessionStateSnapshotEmissionContext,
  at: number,
  reason: string,
  options?: StateSnapshotEmissionOptions
): SimulationEvent | null {
  return emitStateSnapshot(context, 'thief', at, reason, snapshotThiefState(context.state.profession), options);
}

export function projectThiefEndState({
  schedulerState,
  resolverState
}: ThiefEndStateProjectionOptions): Record<string, unknown> {
  const state = snapshotThiefState<ThiefState>(schedulerState.profession);
  // Report resolved spending, since scheduler snapshots only know which charges were granted.
  const resolver = flattenProfessionState<ThiefState>(resolverState);
  state.venomChargeBatches = Object.fromEntries(
    Object.entries(resolver.venomChargeBatches || {}).map(([skillId, batches]) => [
      skillId,
      batches.filter((batch) => batch.charges > 0 && batch.expiresAt > schedulerState.time)
    ])
  );

  // Retain the public scalar as a derived value; expired or consumed charges report zero.
  const publicState = {
    ...state,
    holoUtilityCooldownReductionExpiresAt: Math.max(
      0,
      ...(state.holoUtilityCooldownReductionExpirations || []).filter((expiresAt) => expiresAt > schedulerState.time)
    )
  };
  return projectPublicProfessionState(publicState, THIEF_PUBLIC_END_STATE_KEYS, INACTIVE_STATE_DEFAULTS);
}

// Resolver snapshots are routed back to whichever runtime slice declares each field, preserving scheduler ownership.
export function handleThiefState(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  const incoming = (event.state || {}) as Record<string, unknown>;
  const core = professionCoreState(context) as unknown as Record<string, unknown>;
  const specialization = context.profession.specialization.state as unknown as Record<string, unknown>;
  const preserved: Record<string, unknown> = {
    traitProcProgress: core.traitProcProgress || {},
    traitProcReadyAt: core.traitProcReadyAt || {}
  };
  // Snapshots contain scheduled grants, not resolved spending. Merge only unseen
  // generations so later casts cannot restore consumed charges or erase leftovers.
  const batches = (core.venomChargeBatches || {}) as ThiefState['venomChargeBatches'];
  const incomingBatches = (incoming.venomChargeBatches || {}) as ThiefState['venomChargeBatches'];
  const mergedBatches: ThiefState['venomChargeBatches'] = {};
  const generation = Number(core.venomGeneration || 0);
  for (const skillId of new Set([...Object.keys(batches), ...Object.keys(incomingBatches)])) {
    const active = [
      ...(batches[skillId] || []),
      ...(incomingBatches[skillId] || []).filter((batch) => batch.generation > generation)
    ].filter((batch) => batch.charges > 0 && batch.expiresAt > event.at);
    active.sort((a, b) => a.expiresAt - b.expiresAt);
    mergedBatches[skillId] = active;
  }

  // Repeated snapshots of the same Mortar application must not refill consumed Mistburn charges.
  if (
    context.profession.specialization.kind === 'Antiquary' &&
    Number(incoming.mistburnGeneration || 0) === Number(specialization.mistburnGeneration || 0) &&
    Number(incoming.mistburnExpiresAt || 0) > event.at
  ) {
    preserved.mistburnCharges = specialization.mistburnCharges || 0;
  }

  preserved.venomChargeBatches = mergedBatches;
  preserved.venomGeneration = Math.max(generation, Number(incoming.venomGeneration || 0));

  // Reconcile grants and spending first; shared restoration then routes and detaches each field once.
  restoreFlatProfessionState(core, specialization, { ...incoming, ...preserved });
}
