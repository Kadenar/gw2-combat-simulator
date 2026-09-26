import type { Gw2PlanningStateInput } from '#gw2/platform/simulation/types.js';
import {
  composePublicStateProjections,
  projectPublicProfessionState,
  snapshotProfessionState
} from '#gw2/platform/engine/profession/state.js';
import { REVENANT_CORE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/revenant/core/state.js';
import { CONDUIT_PUBLIC_STATE_PROJECTION } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { RENEGADE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/revenant/specializations/renegade/state.js';
import { VINDICATOR_PUBLIC_STATE_PROJECTION } from '#gw2/professions/revenant/specializations/vindicator/state.js';
import { normalizeSelectedTraitIds } from '#gw2/platform/combat/state/traits.js';
import { applyConduitEnergyCostRules } from '#gw2/professions/revenant/specializations/conduit/mechanics/energy-cost.js';
import { applyVindicatorEnergyCostRules } from '#gw2/professions/revenant/specializations/vindicator/mechanics/energy-cost.js';
import type {
  RevenantEnergyCostInput,
  RevenantRuntimeState,
  RevenantConfig,
  RevenantSkill,
  RevenantState
} from '#gw2/professions/revenant/types.js';

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
  profession
}: Gw2PlanningStateInput<RevenantRuntimeState>): Partial<RevenantState> {
  const state = snapshotProfessionState<RevenantState>(profession);
  return projectPublicProfessionState(state, REVENANT_PUBLIC_END_STATE_KEYS, REVENANT_PUBLIC_STATE_PROJECTION.defaults);
}

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

/** Live owners and the palette share one composed cost, read from the single runtime state. */
export function liveRevenantEnergyCost(
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
