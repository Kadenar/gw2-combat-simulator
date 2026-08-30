import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { createMesmerModuleData } from '#gw2/content/professions/mesmer/catalog/module-data.js';
import {
  troubadourAttributeRules,
  troubadourCastRules,
  troubadourSchedulerHooks,
  troubadourSkillMechanicHandlers
} from '#gw2/content/professions/mesmer/specializations/troubadour/mechanics/instrument-rules.js';
import {
  createTroubadourResolverState,
  troubadourState
} from '#gw2/content/professions/mesmer/specializations/troubadour/state.js';
import { troubadourUi } from '#gw2/content/professions/mesmer/specializations/troubadour/presentation.js';
import {
  MESMER_TROUBADOUR_EXTRA_SKILLS,
  MESMER_TROUBADOUR_SKILL_MECHANICS,
  MESMER_TROUBADOUR_SUPPLEMENTAL_SKILL_MECHANICS
} from '#gw2/content/professions/mesmer/specializations/troubadour/skills/index.js';
import { troubadourSkillHandlers } from '#gw2/content/professions/mesmer/specializations/troubadour/skills/execution.js';
import { troubadourEventHandlers } from '#gw2/content/professions/mesmer/specializations/troubadour/mechanics/state-events.js';
import { TROUBADOUR_BALANCE_PROFILES } from '#gw2/content/professions/mesmer/specializations/troubadour/profiles.js';

export const troubadourModule = defineNativeModule({
  id: 'Troubadour',
  data: createMesmerModuleData('Troubadour', {
    skillMechanics: MESMER_TROUBADOUR_SKILL_MECHANICS,
    supplementalSkillMechanics: MESMER_TROUBADOUR_SUPPLEMENTAL_SKILL_MECHANICS,
    extraSkills: MESMER_TROUBADOUR_EXTRA_SKILLS,
    balanceProfiles: TROUBADOUR_BALANCE_PROFILES
  }),
  state: {
    scheduler: troubadourState.create,
    resolver: createTroubadourResolverState
  },
  mechanics: {
    modifiers: troubadourAttributeRules,
    execution: {
      skillHandlers: troubadourSkillHandlers,
      castRules: troubadourCastRules,
      skillMechanicHandlers: troubadourSkillMechanicHandlers,
      hooks: troubadourSchedulerHooks
    },
    resolution: {
      hooks: { eventHandlers: troubadourEventHandlers }
    }
  },
  presentation: troubadourUi
});
