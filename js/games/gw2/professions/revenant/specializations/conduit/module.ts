import { traitDefinitions } from '#gw2/professions/revenant/specializations/conduit/traits/index.js';
import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { CONDUIT_PUBLIC_STATE_PROJECTION } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/data/module-data.js';
import { conduitEntityModifierRules } from '#gw2/professions/revenant/specializations/conduit/skills/entity-skills.js';
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { conduitUi } from '#gw2/professions/revenant/specializations/conduit/presentation.js';
import { CONDUIT_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/conduit/skills/index.js';
import { conduitHooks } from '#gw2/professions/revenant/specializations/conduit/hooks.js';
import { CONDUIT_SKILL_FIELDS } from '#gw2/professions/revenant/specializations/conduit/skill-fields.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const conduitModule = defineNativeModule({
  traitDefinitions,
  id: 'Conduit',
  data: createRevenantModuleData('Conduit', {
    skillFields: CONDUIT_SKILL_FIELDS,
    skillMechanics: CONDUIT_BASE_SKILL_MECHANICS
  }),
  state: { create: conduitState.create, project: createPublicStateProjector(CONDUIT_PUBLIC_STATE_PROJECTION) },
  // Copy the entity declarations at registration so module composition owns its rule list.
  modifiers: Object.freeze([...conduitEntityModifierRules]),
  hooks: conduitHooks,
  presentation: conduitUi
});
