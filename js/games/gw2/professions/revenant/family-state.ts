import { normalizeSelectedTraitIds } from '#gw2/platform/combat/state/traits.js';
import { applyConduitEnergyCostRules } from '#gw2/professions/revenant/specializations/conduit/mechanics/energy-cost.js';
import { applyVindicatorEnergyCostRules } from '#gw2/professions/revenant/specializations/vindicator/mechanics/energy-cost.js';
import type {
  RevenantEnergyCostInput,
  RevenantRuntimeState,
  RevenantConfig,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';

// Family Energy cost composition: Core supplies the base cost and each elite specialization applies its own policy.
// It lives at the family root because Core modules may not import specialization rules.

/** Resolves the shared upkeep-aware base cost before an elite specialization applies its own policy. */
function baseRevenantEnergyCost({ state }: RevenantEnergyCostInput, skill: RevenantSkill): number {
  const active = (state.activeUpkeeps || []).some((upkeep) => upkeep.skillId === skill.id);
  if (active) return 0;
  return Math.max(0, Number(skill.energyCost || 0));
}

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

/** Runtime hooks and the palette share one composed cost, read from the single runtime state. */
export function revenantEnergyCost(
  runtime: { readonly profession: RevenantRuntimeState; readonly config: RevenantConfig },
  skill: RevenantSkill
): number {
  const { core, specialization } = runtime.profession;
  return effectiveRevenantEnergyCost(
    {
      specialization: specialization.kind,
      state: {
        activeUpkeeps: core.activeUpkeeps,
        ...(specialization.kind === 'Conduit' ? specialization.state : {})
      },
      traits: normalizeSelectedTraitIds(runtime.config.selectedTraitIds)
    },
    skill
  );
}
