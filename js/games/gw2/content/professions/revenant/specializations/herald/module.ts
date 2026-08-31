import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { createRevenantModuleData } from '#gw2/content/professions/revenant/catalog/module-data.js';
import { heraldSkillHandlers } from '#gw2/content/professions/revenant/specializations/herald/skills/execution.js';
import {
  heraldAttributeRules,
  heraldCastRules,
  heraldSchedulerHooks
} from '#gw2/content/professions/revenant/specializations/herald/mechanics/facet-rules.js';
import { heraldState } from '#gw2/content/professions/revenant/specializations/herald/state.js';
import { heraldUi } from '#gw2/content/professions/revenant/specializations/herald/presentation.js';
import {
  HERALD_BALANCE_PROFILES,
  HERALD_BASE_SKILL_MECHANICS
} from '#gw2/content/professions/revenant/specializations/herald/skills/index.js';

export const heraldModule = defineNativeModule({
  id: 'Herald',
  data: createRevenantModuleData('Herald', {
    skillMechanics: HERALD_BASE_SKILL_MECHANICS,
    balanceProfiles: HERALD_BALANCE_PROFILES
  }),
  // Scheduler and resolver share the same (empty) state factory; Herald needs no resolver-private fields.
  state: { scheduler: heraldState.create, resolver: heraldState.create },
  mechanics: {
    modifiers: heraldAttributeRules,
    execution: {
      skillHandlers: heraldSkillHandlers,
      // Herald owns facet activation/consume availability while Core supplies only the shared upkeep resource gate.
      castRules: heraldCastRules,
      hooks: heraldSchedulerHooks
    }
  },
  presentation: heraldUi
});
