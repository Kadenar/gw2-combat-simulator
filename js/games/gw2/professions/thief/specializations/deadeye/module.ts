import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createThiefModuleData } from '#gw2/professions/thief/catalog/module-data.js';
import { deadeyeSkillHandlers } from '#gw2/professions/thief/specializations/deadeye/execution/index.js';
import {
  deadeyeAttributeRules,
  deadeyeCastRules,
  deadeyeSchedulerHooks
} from '#gw2/professions/thief/specializations/deadeye/mechanics/malice-rules.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { deadeyeUi } from '#gw2/professions/thief/specializations/deadeye/presentation.js';
import { DEADEYE_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/deadeye/skills/index.js';
import { DEADEYE_BALANCE_PROFILES } from '#gw2/professions/thief/specializations/deadeye/profiles.js';

export const deadeyeModule = defineNativeModule({
  id: 'Deadeye',
  data: createThiefModuleData('Deadeye', {
    skillMechanics: DEADEYE_SKILL_MECHANICS,
    balanceProfiles: DEADEYE_BALANCE_PROFILES
  }),
  // Same factory for both scheduler and resolver; Deadeye state is fully reconstructed from scratch for each phase
  state: { scheduler: deadeyeState.create, resolver: deadeyeState.create },
  mechanics: {
    modifiers: deadeyeAttributeRules,
    execution: {
      skillHandlers: deadeyeSkillHandlers,
      castRules: deadeyeCastRules,
      hooks: deadeyeSchedulerHooks
    }
  },
  presentation: deadeyeUi
});
