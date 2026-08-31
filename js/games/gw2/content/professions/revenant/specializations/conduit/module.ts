import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { createRevenantModuleData } from '#gw2/content/professions/revenant/catalog/module-data.js';
import { conduitSkillHandlers } from '#gw2/content/professions/revenant/specializations/conduit/skills/execution.js';
import {
  conduitAttributeRules,
  conduitCastRules,
  conduitSchedulerHooks
} from '#gw2/content/professions/revenant/specializations/conduit/mechanics/affinity-rules.js';
import { conduitState } from '#gw2/content/professions/revenant/specializations/conduit/state.js';
import { conduitUi } from '#gw2/content/professions/revenant/specializations/conduit/presentation.js';
import {
  CONDUIT_BASE_SKILL_MECHANICS,
  CONDUIT_BALANCE_PROFILES
} from '#gw2/content/professions/revenant/specializations/conduit/skills/index.js';

export const conduitModule = defineNativeModule({
  id: 'Conduit',
  data: createRevenantModuleData('Conduit', {
    skillMechanics: CONDUIT_BASE_SKILL_MECHANICS,
    balanceProfiles: CONDUIT_BALANCE_PROFILES
  }),
  // Scheduler and resolver each get their own independent copy of ConduitState so they never share mutable affinity.
  state: { scheduler: conduitState.create, resolver: conduitState.create },
  mechanics: {
    modifiers: conduitAttributeRules,
    execution: {
      skillHandlers: conduitSkillHandlers,
      castRules: conduitCastRules,
      hooks: conduitSchedulerHooks
    }
  },
  presentation: conduitUi
});
