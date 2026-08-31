import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { createRangerModuleData } from '#gw2/content/professions/ranger/catalog/module-data.js';
import { galeshotSkillHandlers } from '#gw2/content/professions/ranger/specializations/galeshot/skills/execution.js';
import {
  galeshotAttributeRules,
  galeshotCastRules,
  galeshotSchedulerHooks
} from '#gw2/content/professions/ranger/specializations/galeshot/mechanics/cyclone-bow-rules.js';
import { GALESHOT_BASE_SKILL_MECHANICS } from '#gw2/content/professions/ranger/specializations/galeshot/skills/index.js';
import { galeshotState } from '#gw2/content/professions/ranger/specializations/galeshot/state.js';
import { galeshotUi } from '#gw2/content/professions/ranger/specializations/galeshot/presentation.js';
import { galeshotEventHandlers } from '#gw2/content/professions/ranger/specializations/galeshot/mechanics/state-events.js';
import { GALESHOT_BALANCE_PROFILES } from '#gw2/content/professions/ranger/specializations/galeshot/profiles.js';

export const galeshotModule = defineNativeModule({
  id: 'Galeshot',
  data: createRangerModuleData('Galeshot', {
    skillMechanics: GALESHOT_BASE_SKILL_MECHANICS,
    balanceProfiles: GALESHOT_BALANCE_PROFILES
  }),
  // Both sides share the same factory; the resolver only needs the fields
  // emitted by handleGaleshotState, but reusing the full shape is harmless.
  state: { scheduler: galeshotState.create, resolver: galeshotState.create },
  mechanics: {
    modifiers: galeshotAttributeRules,
    execution: {
      skillHandlers: galeshotSkillHandlers,
      castRules: galeshotCastRules,
      hooks: galeshotSchedulerHooks
    },
    resolution: {
      hooks: { eventHandlers: galeshotEventHandlers }
    }
  },
  presentation: galeshotUi
});
