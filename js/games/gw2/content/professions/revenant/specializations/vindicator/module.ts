import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createRevenantModuleData } from '../../data/catalog.js';
import { vindicatorSkillHandlers } from './skills/handlers.js';
import {
  vindicatorAttributeRules,
  vindicatorCastRules,
  vindicatorSchedulerHooks
} from './mechanics/alliance-and-dodge-rules.js';
import { vindicatorState } from './state.js';
import { vindicatorUi } from './presentation.js';
import { VINDICATOR_BASE_SKILL_MECHANICS, VINDICATOR_BALANCE_PROFILES } from './skills/index.js';

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
