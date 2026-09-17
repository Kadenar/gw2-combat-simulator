import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { onResolvedDamage } from '#gw2/platform/profession-definition/mechanics.js';
import { resolveNatureSiphon } from '#gw2/professions/revenant/specializations/herald/mechanics/facet-passives.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/data/module-data.js';
import { heraldSkillHandlers } from '#gw2/professions/revenant/specializations/herald/execution/index.js';
import {
  heraldAttributeRules,
  heraldCastRules,
  heraldSchedulerHooks
} from '#gw2/professions/revenant/specializations/herald/mechanics/facet-rules.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import { heraldUi } from '#gw2/professions/revenant/specializations/herald/presentation.js';
import { HERALD_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/herald/skills/index.js';
import { HERALD_BALANCE_PROFILES } from '#gw2/professions/revenant/specializations/herald/profiles.js';

export const heraldModule = defineNativeModule({
  id: 'Herald',
  data: createRevenantModuleData('Herald', {
    skillMechanics: HERALD_BASE_SKILL_MECHANICS,
    balanceProfiles: HERALD_BALANCE_PROFILES
  }),
  // The factory gives each phase independent Elevated Compassion and Shared Empowerment ICDs.
  state: { scheduler: heraldState.create, resolver: heraldState.create },
  mechanics: {
    modifiers: heraldAttributeRules,
    execution: {
      skillHandlers: heraldSkillHandlers,
      // Herald owns facet activation/consume availability while Core supplies only the shared upkeep resource gate.
      castRules: heraldCastRules,
      hooks: heraldSchedulerHooks
    },
    resolution: {
      reactions: [onResolvedDamage({ id: 'revenant.herald.nature-siphon', handler: resolveNatureSiphon })]
    }
  },
  presentation: heraldUi
});
