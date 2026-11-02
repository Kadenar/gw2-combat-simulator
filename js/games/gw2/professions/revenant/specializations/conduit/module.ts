import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { TRAIT_LINES } from '#gw2/professions/revenant/data/trait-lines.js';
import {
  CONDUIT_SKILL_FIELDS,
  REVENANT_CONDUIT_PROFILE_FIELDS
} from '#gw2/professions/revenant/specializations/conduit/catalog-fields.js';
import { conduitHooks } from '#gw2/professions/revenant/specializations/conduit/hooks.js';
import { conduitUi } from '#gw2/professions/revenant/specializations/conduit/presentation.js';
import { CONDUIT_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/conduit/skills/index.js';
import { conduitState, projectConduitPlanningState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { traitDefinitions } from '#gw2/professions/revenant/specializations/conduit/traits/index.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const conduitModule = defineNativeModule({
  traitDefinitions,
  id: 'Conduit',
  data: createNativeModuleData<RevenantSkill>({
    id: 'Conduit',
    traitLines: TRAIT_LINES,
    profileFields: REVENANT_CONDUIT_PROFILE_FIELDS,
    skillFields: CONDUIT_SKILL_FIELDS,
    skills: materializeSkillDefinitions(CONDUIT_BASE_SKILL_MECHANICS)
  }),
  state: { create: conduitState.create, project: projectConduitPlanningState },
  // Copy the entity declarations at registration so module composition owns its rule list.
  hooks: conduitHooks,
  presentation: conduitUi
});
