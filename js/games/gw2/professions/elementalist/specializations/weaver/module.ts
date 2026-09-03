import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createElementalistModuleData } from '#gw2/professions/elementalist/catalog/module-data.js';
import {
  weaverAttributeRules,
  weaverCastRules,
  weaverSchedulerHooks,
  weaverSkillMechanicHandlers
} from '#gw2/professions/elementalist/specializations/weaver/mechanics/dual-attunements.js';
import { createWeaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import { weaverUi } from '#gw2/professions/elementalist/specializations/weaver/presentation.js';
import { WEAVER_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/weaver/skills/index.js';
import { WEAVER_BALANCE_PROFILES } from '#gw2/professions/elementalist/specializations/weaver/profiles.js';

/**
 * Weaver specialization module.
 *
 * Binds the dual-attunement mechanics, scheduler/resolver state factories, skill
 * catalog fragments, balance profiles, and UI contract that the registry layers
 * on top of the shared Elementalist core.
 */
export const weaverModule = defineNativeModule({
  id: 'Weaver',
  data: createElementalistModuleData('Weaver', {
    skillMechanics: WEAVER_SKILL_MECHANICS,
    balanceProfiles: WEAVER_BALANCE_PROFILES
  }),
  state: { scheduler: createWeaverState, resolver: createWeaverState },
  mechanics: {
    modifiers: weaverAttributeRules,
    execution: {
      castRules: weaverCastRules,
      skillMechanicHandlers: weaverSkillMechanicHandlers,
      hooks: weaverSchedulerHooks
    }
  },
  presentation: weaverUi
});
