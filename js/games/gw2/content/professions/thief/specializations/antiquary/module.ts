import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { onResolvedDamage } from '#gw2/integrations/patches/authoring/mechanics.js';
import { createThiefModuleData } from '#gw2/content/professions/thief/catalog/module-data.js';
import { antiquarySkillHandlers } from '#gw2/content/professions/thief/specializations/antiquary/skills/execution.js';
import { antiquaryResolverEventReactions } from '#gw2/content/professions/thief/specializations/antiquary/mechanics/artifact-effects.js';
import {
  antiquaryAttributeRules,
  antiquaryCastRules,
  antiquarySchedulerHooks
} from '#gw2/content/professions/thief/specializations/antiquary/mechanics/artifact-rules.js';
import { antiquaryState } from '#gw2/content/professions/thief/specializations/antiquary/state.js';
import { antiquaryUi } from '#gw2/content/professions/thief/specializations/antiquary/presentation.js';
import { ANTIQUARY_SKILL_MECHANICS } from '#gw2/content/professions/thief/specializations/antiquary/skills/index.js';
import { ANTIQUARY_BALANCE_PROFILES } from '#gw2/content/professions/thief/specializations/antiquary/profiles.js';

export const antiquaryModule = defineNativeModule({
  id: 'Antiquary',
  data: createThiefModuleData('Antiquary', {
    skillMechanics: ANTIQUARY_SKILL_MECHANICS,
    balanceProfiles: ANTIQUARY_BALANCE_PROFILES
  }),
  state: { scheduler: antiquaryState.create, resolver: antiquaryState.create },
  mechanics: {
    modifiers: antiquaryAttributeRules,
    execution: {
      skillHandlers: antiquarySkillHandlers,
      castRules: antiquaryCastRules,
      hooks: antiquarySchedulerHooks
    },
    resolution: {
      reactions: [
        onResolvedDamage({
          id: 'thief.antiquary.damage',
          handler: antiquaryResolverEventReactions.damage
        })
      ]
    }
  },
  presentation: antiquaryUi
});
