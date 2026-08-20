import type { ConduitState, RevenantEnergyContext, RevenantRuntimeState, RevenantSkill } from '../../types.js';

function conduitEnergyState(context: RevenantEnergyContext): Partial<ConduitState> {
  const schedulerState = context.state && 'profession' in context.state ? context.state : undefined;
  const candidate = schedulerState?.profession ?? context.professionState ?? context.state ?? {};
  if (candidate && typeof candidate === 'object' && 'core' in candidate && 'specialization' in candidate) {
    return (candidate as RevenantRuntimeState).specialization.state as Partial<ConduitState>;
  }

  return candidate as Partial<ConduitState>;
}

/** Applies Conduit form overrides and Beguiling Haze follow-up charges to the shared base cost. */
export function effectiveConduitEnergyCost(
  context: RevenantEnergyContext,
  skill: RevenantSkill,
  baseCost: number
): number {
  if (baseCost <= 0) return 0;
  const state = conduitEnergyState(context);
  if (skill.freeWhenStatePositive && Number(state[skill.freeWhenStatePositive as keyof ConduitState] || 0) > 0) {
    return 0;
  }

  const override = state.energyCostOverrides?.[String(skill.id)];
  return override == null ? baseCost : Math.max(0, Number(override));
}
