import { emitStateSnapshot } from '../../platform/engine/events/state-snapshots.js';
import { professionCoreState } from '../../platform/engine/profession/state.js';
import { snapshotRevenantState } from './state.js';
import { REVENANT_SKILL_IDS as ID } from './data/ids.js';
import { baseRevenantEnergyCost } from './core/energy.js';
import { applyConduitEnergyCostRules } from './specializations/conduit/energy.js';
import { applyVindicatorEnergyCostRules } from './specializations/vindicator/energy.js';
import type { RevenantEnergyContext, RevenantPrecastContext, RevenantRuntimeState, RevenantSkill } from './types.js';

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
    emitStateSnapshot(
      context,
      'revenant',
      context.start,
      'energy-spent',
      snapshotRevenantState(context.state.profession)
    );
  }
}
