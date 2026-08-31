import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { createRevenantModuleData } from '#gw2/content/professions/revenant/catalog/module-data.js';
import { vindicatorSkillHandlers } from '#gw2/content/professions/revenant/specializations/vindicator/skills/execution.js';
import {
  vindicatorAttributeRules,
  vindicatorCastRules,
  vindicatorSchedulerHooks
} from '#gw2/content/professions/revenant/specializations/vindicator/mechanics/alliance-and-dodge-rules.js';
import { vindicatorState } from '#gw2/content/professions/revenant/specializations/vindicator/state.js';
import { vindicatorUi } from '#gw2/content/professions/revenant/specializations/vindicator/presentation.js';
import {
  VINDICATOR_BASE_SKILL_MECHANICS,
  VINDICATOR_BALANCE_PROFILES
} from '#gw2/content/professions/revenant/specializations/vindicator/skills/index.js';

export const vindicatorModule = defineNativeModule({
  id: 'Vindicator',
  data: createRevenantModuleData('Vindicator', {
    skillMechanics: VINDICATOR_BASE_SKILL_MECHANICS,
    balanceProfiles: VINDICATOR_BALANCE_PROFILES
  }),
  state: {
    // scheduler and resolver each call create independently; they do not share a state object.
    scheduler: vindicatorState.create,
    resolver: vindicatorState.create
  },
  mechanics: {
    modifiers: vindicatorAttributeRules,
    execution: {
      skillHandlers: vindicatorSkillHandlers,
      castRules: vindicatorCastRules,
      // Dodge strike emission is a scheduler hook, not a cast handler, because the strike fires in response to the dodge state event rather than directly inside the dodge cast.
      hooks: vindicatorSchedulerHooks
    }
  },
  presentation: vindicatorUi
});
