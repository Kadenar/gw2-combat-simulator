import type { ReadonlyMechanicState } from '#gw2/platform/profession-definition/runtime-context.js';
import { normalizeSelectedTraitIds } from '#gw2/platform/builds/selected-traits.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { applyConduitEnergyCostRules } from '#gw2/professions/revenant/specializations/conduit/mechanics/energy-cost.js';
import { HERALD_SPIRIT_BOON_PROFILE_ID } from '#gw2/professions/revenant/specializations/herald/profiles.js';
import { RENEGADE_SPIRIT_BOON_PROFILE_ID } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { applyVindicatorEnergyCostRules } from '#gw2/professions/revenant/specializations/vindicator/mechanics/energy-cost.js';
import type {
  RevenantConfig,
  RevenantEnergyCostInput,
  RevenantRuntimeState,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';

// Family Energy cost composition: Core supplies the base cost and each elite specialization applies its own policy.
// It lives at the family root because Core modules may not import specialization rules.

// Family composition supplies elite declarations without making Core import specialization modules.
export const REVENANT_ELITE_INVOCATIONS: Readonly<Record<string, { spiritBoon: SkillId; song: SkillId }>> = {
  [LEGEND.DRAGON]: { spiritBoon: HERALD_SPIRIT_BOON_PROFILE_ID, song: ID.CALL_OF_THE_DRAGON },
  [LEGEND.RENEGADE]: { spiritBoon: RENEGADE_SPIRIT_BOON_PROFILE_ID, song: ID.CALL_OF_THE_RENEGADE },
  // This family-owned identifier must initialize without loading Vindicator's runtime behavior.
  [LEGEND.ALLIANCE]: { spiritBoon: 'revenant.spirit-boon.alliance', song: ID.CALL_OF_THE_ALLIANCE }
};

/** Resolves the shared upkeep-aware base cost before an elite specialization applies its own policy. */
function baseRevenantEnergyCost({ state }: RevenantEnergyCostInput, skill: RevenantSkill): number {
  const active = (state.activeUpkeeps || []).some((upkeep) => upkeep.skillId === skill.id);
  if (active) return 0;
  return Math.max(0, skill.energyCost || 0);
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
  runtime: ReadonlyMechanicState<{
    readonly profession: RevenantRuntimeState;
    readonly config: RevenantConfig;
    readonly time: number;
  }>,
  skill: RevenantSkill
): number {
  const { core, specialization } = runtime.profession;
  return effectiveRevenantEnergyCost(
    {
      specialization: specialization.kind,
      time: runtime.time,
      state: {
        activeUpkeeps: core.activeUpkeeps,
        ...(specialization.kind === 'Conduit' ? specialization.state : {})
      },
      traits: normalizeSelectedTraitIds(runtime.config.selectedTraitIds)
    },
    skill
  );
}
