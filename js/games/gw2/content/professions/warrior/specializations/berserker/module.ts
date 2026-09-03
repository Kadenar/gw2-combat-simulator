import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { createWarriorModuleData } from '#gw2/content/professions/warrior/catalog/module-data.js';
import { BERSERKER_SKILL_MECHANICS } from '#gw2/content/professions/warrior/specializations/berserker/skills/index.js';
import { berserkerSkillHandlers } from '#gw2/content/professions/warrior/specializations/berserker/execution/index.js';
import {
  berserkerAttributeRules,
  berserkerCastRules,
  berserkerSchedulerHooks
} from '#gw2/content/professions/warrior/specializations/berserker/mechanics/berserk-rules.js';
import { berserkerState } from '#gw2/content/professions/warrior/specializations/berserker/state.js';
import { berserkerUi } from '#gw2/content/professions/warrior/specializations/berserker/presentation.js';
import { berserkerReactions } from '#gw2/content/professions/warrior/specializations/berserker/mechanics/berserk-effects.js';
import { BERSERKER_BALANCE_PROFILES } from '#gw2/content/professions/warrior/specializations/berserker/profiles.js';

export const berserkerModule = defineNativeModule({
  id: 'Berserker',
  data: createWarriorModuleData('Berserker', {
    skillMechanics: BERSERKER_SKILL_MECHANICS,
    balanceProfiles: BERSERKER_BALANCE_PROFILES
  }),
  state: { scheduler: berserkerState.create, resolver: berserkerState.create },
  mechanics: {
    modifiers: berserkerAttributeRules,
    execution: {
      skillHandlers: berserkerSkillHandlers,
      castRules: berserkerCastRules,
      hooks: berserkerSchedulerHooks
    },
    resolution: {
      reactions: berserkerReactions
    }
  },
  presentation: berserkerUi
});
