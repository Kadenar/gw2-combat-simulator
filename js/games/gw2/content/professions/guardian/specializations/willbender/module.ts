import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { createGuardianModuleData } from '#gw2/content/professions/guardian/catalog/module-data.js';
import { willbenderSkillHandlers } from '#gw2/content/professions/guardian/specializations/willbender/skills/execution.js';
import { willbenderEventHandlers } from '#gw2/content/professions/guardian/specializations/willbender/mechanics/virtue-effects.js';
import {
  willbenderAttributeRules,
  willbenderSchedulerHooks,
  willbenderSkillMechanicHandlers
} from '#gw2/content/professions/guardian/specializations/willbender/mechanics/virtue-rules.js';
import { WILLBENDER_SKILL_MECHANICS } from '#gw2/content/professions/guardian/specializations/willbender/skills/index.js';
import { willbenderState } from '#gw2/content/professions/guardian/specializations/willbender/state.js';
import { willbenderUi } from '#gw2/content/professions/guardian/specializations/willbender/presentation.js';
import { WILLBENDER_BALANCE_PROFILES } from '#gw2/content/professions/guardian/specializations/willbender/profiles.js';

export const willbenderModule = defineNativeModule({
  id: 'Willbender',
  data: createGuardianModuleData('Willbender', {
    skillMechanics: WILLBENDER_SKILL_MECHANICS,
    balanceProfiles: WILLBENDER_BALANCE_PROFILES
  }),
  state: {
    // Scheduler and resolver each get their own independent instance of the same
    // shape; they must not share a reference because the two phases run separately.
    scheduler: willbenderState.create,
    resolver: willbenderState.create
  },
  mechanics: {
    modifiers: willbenderAttributeRules,
    execution: {
      skillHandlers: willbenderSkillHandlers,
      skillMechanicHandlers: willbenderSkillMechanicHandlers,
      hooks: willbenderSchedulerHooks
    },
    resolution: {
      hooks: { eventHandlers: willbenderEventHandlers }
    }
  },
  presentation: willbenderUi
});
