import type { RevenantEnergyCostInput, RevenantSkill } from '#gw2/professions/revenant/types.js';
import type { ConduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';

/** Identifies Beguiling Haze follow-ups so only their temporary charges waive the skill's Energy cost. */
function isBeguilingHazeFollowUp(state: Partial<ConduitState>, skill: RevenantSkill): boolean {
  return skill.handlerId === 'revenant.beguiling-haze' && Number(state.beguilingHazeCharges || 0) > 0;
}

/** Applies Conduit form overrides and Beguiling Haze follow-up charges to the shared base cost. */
export function applyConduitEnergyCostRules(
  { state }: RevenantEnergyCostInput,
  skill: RevenantSkill,
  baseCost: number
): number {
  if (baseCost <= 0) return 0;
  if (isBeguilingHazeFollowUp(state, skill)) return 0;

  const override = state.energyCostOverrides?.[String(skill.id)];
  return override == null ? baseCost : Math.max(0, Number(override));
}
