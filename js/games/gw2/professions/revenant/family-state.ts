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
import { REVENANT_CORE_PUBLIC_END_STATE_KEYS } from '#gw2/professions/revenant/core/state.js';
import {
  CONDUIT_PUBLIC_END_STATE_KEYS,
  CONDUIT_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '#gw2/professions/revenant/specializations/conduit/state.js';
import {
  RENEGADE_PUBLIC_END_STATE_KEYS,
  RENEGADE_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '#gw2/professions/revenant/specializations/renegade/state.js';
import {
  VINDICATOR_PUBLIC_END_STATE_KEYS,
  VINDICATOR_PUBLIC_INACTIVE_STATE_DEFAULTS
} from '#gw2/professions/revenant/specializations/vindicator/state.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { baseRevenantEnergyCost } from '#gw2/professions/revenant/core/mechanics/energy.js';
import { applyConduitEnergyCostRules } from '#gw2/professions/revenant/specializations/conduit/mechanics/energy-cost.js';
import { applyVindicatorEnergyCostRules } from '#gw2/professions/revenant/specializations/vindicator/mechanics/energy-cost.js';
import type {
  RevenantEnergyContext,
  RevenantPrecastContext,
  RevenantResolverContext,
  RevenantResolverEvent,
  RevenantRuntimeState,
  RevenantSkill,
  RevenantState
} from '#gw2/professions/revenant/types.js';
import type { HeraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import type { RenegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import type { SchedulerState } from '#gw2/platform/engine/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';

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
  const preservedNatureSiphonReadyAt =
    context.profession.specialization.kind === 'Herald'
      ? (specialization as HeraldState).natureSiphonReadyAt
      : undefined;
  const preservedSoulcleaveReadyAt =
    context.profession.specialization.kind === 'Renegade'
      ? (specialization as RenegadeState).soulcleaveReadyAt
      : undefined;
  restoreFlatProfessionState(core, specialization, event.state);

  core.traitProcReadyAt = preservedCoreTraitProcReadyAt;
  if (context.profession.specialization.kind === 'Herald') {
    (specialization as HeraldState).natureSiphonReadyAt = Number(preservedNatureSiphonReadyAt || 0);
  }

  if (context.profession.specialization.kind === 'Renegade') {
    (specialization as RenegadeState).soulcleaveReadyAt = Number(preservedSoulcleaveReadyAt || 0);
  }
}

// Family Energy cost composition: Core supplies the base cost and each elite specialization applies its own policy.
// It lives at the family root because Core modules may not import specialization rules.

// Resolve the active Revenant specialization consistently from runtime and
// configuration shapes used by energy rules.
function revenantEnergySpecialization(context: RevenantEnergyContext): string {
  const schedulerState = context.state && 'profession' in context.state ? context.state : undefined;
  const candidate = schedulerState?.profession ?? context.state;
  if (candidate && typeof candidate === 'object' && 'specialization' in candidate) {
    return String((candidate as RevenantRuntimeState).specialization.kind);
  }

  return String(context.config?.specialization || 'Core');
}

/** Composes the shared base Energy cost with the active elite specialization's policy. */
export function effectiveRevenantEnergyCost(context: RevenantEnergyContext, skill: RevenantSkill): number {
  const baseCost = baseRevenantEnergyCost(context, skill);
  switch (revenantEnergySpecialization(context)) {
    case 'Conduit':
      return applyConduitEnergyCostRules(context, skill, baseCost);
    case 'Vindicator':
      return applyVindicatorEnergyCostRules(context, skill, baseCost);
    default:
      return baseCost;
  }
}

/** Pays a cast's composed family Energy cost after all specialization policies have run. */
export function spendRevenantEnergy(context: RevenantPrecastContext, skill: RevenantSkill): void {
  if (([ID.SWAP_LEGENDS, ID.DODGE] as readonly number[]).includes(Number(skill.id))) return;
  const state = professionCoreState(context);
  const cost = effectiveRevenantEnergyCost(context, skill);
  state.energy = Math.max(0, state.energy - cost);
  if (cost > 0) {
    emitRevenantStateSnapshot(context, context.start, 'energy-spent');
  }
}
