import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { onConditionApplied } from '#gw2/integrations/patches/authoring/mechanics.js';
import { createThiefModuleData } from '#gw2/content/professions/thief/catalog/module-data.js';
import { specterSkillHandlers } from '#gw2/content/professions/thief/specializations/specter/skills/execution.js';
import { specterAttributeRules, specterCastRules, specterSchedulerHooks } from '#gw2/content/professions/thief/specializations/specter/mechanics/shadow-shroud-rules.js';
import { specterState } from '#gw2/content/professions/thief/specializations/specter/state.js';
import { specterUi } from '#gw2/content/professions/thief/specializations/specter/presentation.js';
import { SPECTER_SKILL_MECHANICS } from '#gw2/content/professions/thief/specializations/specter/skills/index.js';
import { applyLarcenousTorment } from '#gw2/content/professions/thief/specializations/specter/mechanics/shadow-shroud-effects.js';
import { SPECTER_BALANCE_PROFILES } from '#gw2/content/professions/thief/specializations/specter/profiles.js';

export const specterModule = defineNativeModule({
  id: 'Specter',
  data: createThiefModuleData('Specter', {
    skillMechanics: SPECTER_SKILL_MECHANICS,
    balanceProfiles: SPECTER_BALANCE_PROFILES
  }),
  // Both phases get independent state instances; sharing the factory is fine because create is called twice.
  state: { scheduler: specterState.create, resolver: specterState.create },
  mechanics: {
    modifiers: specterAttributeRules,
    execution: {
      skillHandlers: specterSkillHandlers,
      castRules: specterCastRules,
      hooks: specterSchedulerHooks
    },
    resolution: {
      reactions: [
        onConditionApplied({
          id: 'thief.specter.larcenous-torment',
          handler: applyLarcenousTorment
        })
      ]
    }
  },
  presentation: specterUi
});
