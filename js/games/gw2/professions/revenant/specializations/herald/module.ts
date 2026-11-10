import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState
} from '#gw2/professions/revenant/core/state-queries.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { TRAIT_LINES } from '#gw2/professions/revenant/data/trait-lines.js';
import {
  HERALD_SKILL_FIELDS,
  REVENANT_HERALD_PROFILE_FIELDS
} from '#gw2/professions/revenant/specializations/herald/catalog-fields.js';
import { heraldHooks } from '#gw2/professions/revenant/specializations/herald/hooks.js';
import { heraldFacetPassive } from '#gw2/professions/revenant/specializations/herald/mechanics/facets.js';
import { heraldUi } from '#gw2/professions/revenant/specializations/herald/presentation.js';
import { HERALD_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/herald/skills/index.js';
import { REVENANT_HERALD_SKILL_FLIPS } from '#gw2/professions/revenant/specializations/herald/skills/skill-flips.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import { traitDefinitions } from '#gw2/professions/revenant/specializations/herald/traits/index.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const heraldModule = defineNativeModule({
  id: 'Herald',
  data: createNativeModuleData<RevenantSkill>({
    id: 'Herald',
    traitLines: TRAIT_LINES,
    skillFlips: REVENANT_HERALD_SKILL_FLIPS,
    profileFields: REVENANT_HERALD_PROFILE_FIELDS,
    skillFields: HERALD_SKILL_FIELDS,
    skills: materializeSkillDefinitions(HERALD_BASE_SKILL_MECHANICS)
  }),
  state: { create: heraldState.create },
  traitDefinitions,
  /** Dragon Nature adds duration after the normal cap without changing Concentration. */
  attributes: (context) => {
    const core = revenantRuntimeCoreState(context);
    const state = revenantRuntimeSpecializationState(context, 'Herald');

    const passive = heraldFacetPassive(core, state, ID.FACET_OF_NATURE, context.time);

    if (!passive) return [];

    return [
      {
        uncappedBoonDuration: passive.legendId === LEGEND.DRAGON ? 20 : 0
      }
    ];
  },
  hooks: heraldHooks,
  presentation: heraldUi
});
