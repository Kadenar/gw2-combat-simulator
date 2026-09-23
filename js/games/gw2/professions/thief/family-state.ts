import { snapshotProfessionState } from '#gw2/platform/engine/profession/state.js';
import { expireCharges, replayChargeGrants } from '#gw2/platform/combat/resources/charges.js';
import {
  composePublicStateProjections,
  flattenProfessionState,
  professionCoreState,
  projectPublicProfessionState,
  restoreFlatProfessionState
} from '#gw2/platform/engine/profession/state.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import type {
  ProfessionStateSnapshotEmissionContext,
  StateSnapshotEmissionOptions
} from '#gw2/platform/engine/events/state-snapshots.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { THIEF_CORE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/thief/core/state.js';
import { ANTIQUARY_PUBLIC_STATE_PROJECTION } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { DAREDEVIL_PUBLIC_STATE_PROJECTION } from '#gw2/professions/thief/specializations/daredevil/state.js';
import { DEADEYE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { SPECTER_PUBLIC_STATE_PROJECTION } from '#gw2/professions/thief/specializations/specter/state.js';
import { ANTIQUARY_THIEVES_GUILD_SUMMON } from '#gw2/professions/thief/specializations/antiquary/mechanics/thieves-guild.js';
import { DAREDEVIL_THIEVES_GUILD_SUMMON } from '#gw2/professions/thief/specializations/daredevil/mechanics/thieves-guild.js';
import { DEADEYE_THIEVES_GUILD_SUMMON } from '#gw2/professions/thief/specializations/deadeye/mechanics/thieves-guild.js';
import { SPECTER_THIEVES_GUILD_SUMMON } from '#gw2/professions/thief/specializations/specter/mechanics/thieves-guild.js';
import type {
  ThiefPlanningStateProjectionOptions,
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefState,
  ThiefSummonDefinition
} from '#gw2/professions/thief/types.js';

// Compose public metadata once; runtime initialization and resolver ownership stay with each slice.
const THIEF_PUBLIC_STATE_PROJECTION = composePublicStateProjections([
  THIEF_CORE_PUBLIC_STATE_PROJECTION,
  DAREDEVIL_PUBLIC_STATE_PROJECTION,
  DEADEYE_PUBLIC_STATE_PROJECTION,
  SPECTER_PUBLIC_STATE_PROJECTION,
  ANTIQUARY_PUBLIC_STATE_PROJECTION
]);

export const THIEF_PUBLIC_END_STATE_KEYS = THIEF_PUBLIC_STATE_PROJECTION.keys;

/** Emits a complete Thief snapshot while leaving generation reconciliation owner-local. */
export function emitThiefStateSnapshot(
  context: ProfessionStateSnapshotEmissionContext,
  at: number,
  reason: string,
  options?: StateSnapshotEmissionOptions
): SimulationEvent | null {
  return emitStateSnapshot(context, 'thief', at, reason, flattenProfessionState(context.state.profession), options);
}

/** Publish detached clocks and grants so presentation cannot mutate live resource state. */
export function projectThiefPlanningState({
  schedulerState
}: ThiefPlanningStateProjectionOptions): Record<string, unknown> {
  const state = snapshotProfessionState<ThiefState>(schedulerState.profession);
  // Expire the detached grant for display without advancing the live scheduler state.
  if (state.mistburn) expireCharges(state.mistburn, schedulerState.time);
  state.combatHighExpirations = purgeExpiredStacks(state.combatHighExpirations || [], schedulerState.time);
  // Publish the surviving uses themselves, preserving their FIFO order on the detached snapshot.
  state.holoUtilityCooldownReductionExpirations = purgeExpiredStacks(
    state.holoUtilityCooldownReductionExpirations || [],
    schedulerState.time
  );
  return projectPublicProfessionState(state, THIEF_PUBLIC_END_STATE_KEYS, THIEF_PUBLIC_STATE_PROJECTION.defaults);
}

// Resolver snapshots are routed back to whichever runtime slice declares each field, preserving scheduler ownership.
export function handleThiefState(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  const incoming = (event.state || {}) as Partial<ThiefState>;
  const core = professionCoreState(context) as unknown as Record<string, unknown>;
  const specialization = context.profession.specialization.state as unknown as Record<string, unknown>;
  const preserved: Record<string, unknown> = {
    traitProcProgress: core.traitProcProgress || {},
    traitProcReadyAt: core.traitProcReadyAt || {}
  };
  // Later scheduler checkpoints cannot rearm a grant already consumed by a hit.
  if (
    context.profession.specialization.kind === 'Daredevil' &&
    incoming.weakeningStrikeGeneration === specialization.weakeningStrikeGeneration
  ) {
    preserved.weakeningStrikeReady = specialization.weakeningStrikeReady;
  }

  // Snapshots contain scheduled grants, not resolved spending. Merge only unseen
  // generations so later casts cannot restore consumed charges or erase leftovers.
  const batches = (core.venomChargeBatches || {}) as ThiefState['venomChargeBatches'];
  const incomingBatches = (incoming.venomChargeBatches || {}) as ThiefState['venomChargeBatches'];
  const mergedBatches: ThiefState['venomChargeBatches'] = {};
  const generation = Number(core.venomGeneration || 0);
  for (const skillId of new Set([...Object.keys(batches), ...Object.keys(incomingBatches)])) {
    mergedBatches[skillId] = replayChargeGrants(
      batches[skillId] || [],
      incomingBatches[skillId] || [],
      generation,
      event.at
    );
  }

  // Repeated snapshots of the same Mortar application must not refill consumed Mistburn charges.
  if (
    context.profession.specialization.kind === 'Antiquary' &&
    Number(incoming.mistburnGeneration || 0) === Number(specialization.mistburnGeneration || 0) &&
    Number(incoming.mistburn?.expiresAt || 0) > event.at
  ) {
    preserved.mistburn = specialization.mistburn;
  }

  preserved.venomChargeBatches = mergedBatches;
  preserved.venomGeneration = Math.max(generation, Number(incoming.venomGeneration || 0));

  // Reconcile grants and spending first; shared restoration then routes and detaches each field once.
  restoreFlatProfessionState(core, specialization, { ...incoming, ...preserved });
}

const SPECIALIZATION_THIEVES_GUILD_SUMMON: Readonly<Record<string, ThiefSummonDefinition>> = Object.freeze({
  Antiquary: ANTIQUARY_THIEVES_GUILD_SUMMON,
  Daredevil: DAREDEVIL_THIEVES_GUILD_SUMMON,
  Deadeye: DEADEYE_THIEVES_GUILD_SUMMON,
  Specter: SPECTER_THIEVES_GUILD_SUMMON
});

// Family-level dispatch selects a specialization-owned summon without leaking elite definitions into Core.
export function thiefSpecializationGuildSummon(specialization: string): ThiefSummonDefinition | null {
  return SPECIALIZATION_THIEVES_GUILD_SUMMON[specialization] || null;
}
