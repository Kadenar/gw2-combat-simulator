import {
  composePublicStateProjections,
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
import { REVENANT_CORE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/revenant/core/state.js';
import { CONDUIT_PUBLIC_STATE_PROJECTION } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { RENEGADE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/revenant/specializations/renegade/state.js';
import { VINDICATOR_PUBLIC_STATE_PROJECTION } from '#gw2/professions/revenant/specializations/vindicator/state.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { baseRevenantEnergyCost } from '#gw2/professions/revenant/core/mechanics/energy.js';
import { normalizeSelectedTraitIds } from '#gw2/platform/combat/state/traits.js';
import { applyConduitEnergyCostRules } from '#gw2/professions/revenant/specializations/conduit/mechanics/energy-cost.js';
import { applyVindicatorEnergyCostRules } from '#gw2/professions/revenant/specializations/vindicator/mechanics/energy-cost.js';
import type {
  RevenantEnergyCostInput,
  RevenantPrecastContext,
  RevenantResolverContext,
  RevenantResolverEvent,
  RevenantRuntimeState,
  RevenantSchedulerContext,
  RevenantSkill,
  RevenantState
} from '#gw2/professions/revenant/types.js';
import type { HeraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import type { RenegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import type { SchedulerState } from '#gw2/platform/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';

/** Emits a complete Revenant snapshot with the family identity owned here. */
export function emitRevenantStateSnapshot(
  context: ProfessionStateSnapshotEmissionContext,
  at: number,
  reason: string,
  options?: StateSnapshotEmissionOptions
): SimulationEvent | null {
  return emitStateSnapshot(
    context,
    'revenant',
    at,
    reason,
    snapshotProfessionState<RevenantState>(context.state.profession),
    options
  );
}

// Compose public metadata once; runtime initialization and resolver ownership stay with each slice.
const REVENANT_PUBLIC_STATE_PROJECTION = composePublicStateProjections([
  REVENANT_CORE_PUBLIC_STATE_PROJECTION,
  RENEGADE_PUBLIC_STATE_PROJECTION,
  VINDICATOR_PUBLIC_STATE_PROJECTION,
  CONDUIT_PUBLIC_STATE_PROJECTION
]);

export const REVENANT_PUBLIC_END_STATE_KEYS = REVENANT_PUBLIC_STATE_PROJECTION.keys;

/** Projects the public Revenant state while supplying stable defaults for inactive elite specializations. */
export function projectRevenantPlanningState({
  schedulerState
}: {
  schedulerState: SchedulerState<RevenantRuntimeState>;
}): Partial<RevenantState> {
  const state = snapshotProfessionState<RevenantState>(schedulerState.profession);
  return projectPublicProfessionState(state, REVENANT_PUBLIC_END_STATE_KEYS, REVENANT_PUBLIC_STATE_PROJECTION.defaults);
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

/** Composes the shared base Energy cost with the active elite specialization's policy. */
export function effectiveRevenantEnergyCost(input: RevenantEnergyCostInput, skill: RevenantSkill): number {
  const baseCost = baseRevenantEnergyCost(input, skill);
  switch (input.specialization) {
    case 'Conduit':
      return applyConduitEnergyCostRules(input, skill, baseCost);
    case 'Vindicator':
      return applyVindicatorEnergyCostRules(input, skill, baseCost);
    default:
      return baseCost;
  }
}

/** Supplies owned runtime state to the same cost calculation used by the palette. */
export function runtimeRevenantEnergyCost(context: RevenantSchedulerContext, skill: RevenantSkill): number {
  const { core, specialization } = context.state.profession;
  return effectiveRevenantEnergyCost(
    {
      specialization: specialization.kind,
      state: {
        activeUpkeeps: core.activeUpkeeps,
        ...(specialization.kind === 'Conduit' ? specialization.state : {})
      },
      traits: normalizeSelectedTraitIds(context.config.selectedTraitIds)
    },
    skill
  );
}

/** Pays a cast's composed family Energy cost after all specialization policies have run. */
export function spendRevenantEnergy(context: RevenantPrecastContext, skill: RevenantSkill): void {
  if (([ID.SWAP_LEGENDS, ID.DODGE] as readonly number[]).includes(Number(skill.id))) return;
  const state = professionCoreState(context);
  const cost = runtimeRevenantEnergyCost(context, skill);
  state.energy = Math.max(0, state.energy - cost);
  if (cost > 0) {
    emitRevenantStateSnapshot(context, context.start, 'energy-spent');
  }
}
