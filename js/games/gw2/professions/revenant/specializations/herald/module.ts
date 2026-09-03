import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { augmentSkill } from '#gw2/platform/profession-definition/mechanics.js';
import type { SkillHandlerPhase } from '#gw2/platform/engine/types.js';
import type { RevenantCastContext } from '#gw2/professions/revenant/types.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/catalog/module-data.js';
import { consumeRevenantFacet } from '#gw2/professions/revenant/specializations/herald/mechanics/facet-upkeep.js';
import {
  heraldAttributeRules,
  heraldCastRules,
  heraldSchedulerHooks
} from '#gw2/professions/revenant/specializations/herald/mechanics/facet-rules.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import { heraldUi } from '#gw2/professions/revenant/specializations/herald/presentation.js';
import { HERALD_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/herald/skills/index.js';
import { HERALD_BALANCE_PROFILES } from '#gw2/professions/revenant/specializations/herald/profiles.js';

/** Appends facet teardown after each consume skill's catalog effects. */
const heraldSkillHandlers = new Map([
  [
    'revenant.facet-consume',
    augmentSkill<RevenantCastContext>({
      afterEffects: consumeRevenantFacet as SkillHandlerPhase<RevenantCastContext>
    })
  ]
]);

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
