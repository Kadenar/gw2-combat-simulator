import type { ConduitState, RevenantEnergyContext, RevenantRuntimeState, RevenantSkill } from '../../types.js';

// Extract Conduit specialization state only when that specialization is active,
// preventing energy rules from reading another module's shape.
function conduitEnergyState(context: RevenantEnergyContext): Partial<ConduitState> {
  const schedulerState = context.state && 'profession' in context.state ? context.state : undefined;
  const candidate = schedulerState?.profession ?? context.professionState ?? context.state ?? {};

  if (candidate && typeof candidate === 'object' && 'core' in candidate && 'specialization' in candidate) {
    return (candidate as RevenantRuntimeState).specialization.state as Partial<ConduitState>;
  }

  return candidate as Partial<ConduitState>;
}

/** Identifies Beguiling Haze follow-ups so only their temporary charges waive the skill's Energy cost. */
function isBeguilingHazeFollowUp(state: Partial<ConduitState>, skill: RevenantSkill): boolean {
  return skill.handlerId === 'revenant.beguiling-haze' && Number(state.beguilingHazeCharges || 0) > 0;
}

/** Applies Conduit form overrides and Beguiling Haze follow-up charges to the shared base cost. */
export function applyConduitEnergyCostRules(
  context: RevenantEnergyContext,
  skill: RevenantSkill,
  baseCost: number
): number {
  if (baseCost <= 0) return 0;
  const state = conduitEnergyState(context);

  if (isBeguilingHazeFollowUp(state, skill)) return 0;

  const override = state.energyCostOverrides?.[String(skill.id)];
  return override == null ? baseCost : Math.max(0, Number(override));
}
