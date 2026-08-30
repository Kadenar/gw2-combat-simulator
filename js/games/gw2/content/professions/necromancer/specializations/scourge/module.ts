import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { onConditionApplied } from '../../../../../integrations/patches/authoring/mechanics.js';
import { createNecromancerModuleData } from '../../data/catalog.js';
import { scourgeSkillHandlers } from './skills/handlers.js';
import { scourgeResolverEventReactions } from './mechanics/shade-effects.js';
import { scourgeAttributeRules, scourgeCastRules, scourgeSchedulerHooks } from './mechanics/shade-rules.js';
import { scourgeState } from './state.js';
import { scourgeUi } from './presentation.js';
import { SCOURGE_BASE_SKILL_MECHANICS } from './skills/index.js';
import { SCOURGE_BALANCE_PROFILES } from './profiles.js';

export const scourgeModule = defineNativeModule({
  id: 'Scourge',
  data: createNecromancerModuleData('Scourge', {
    skillMechanics: SCOURGE_BASE_SKILL_MECHANICS,
    balanceProfiles: SCOURGE_BALANCE_PROFILES
  }),
  state: { scheduler: scourgeState.create, resolver: scourgeState.create },
  mechanics: {
    modifiers: scourgeAttributeRules,
    execution: {
      skillHandlers: scourgeSkillHandlers,
      castRules: scourgeCastRules,
      hooks: scourgeSchedulerHooks
    },
    resolution: {
      reactions: [
        // Demonic Lore fires on every Torment application; ICD is enforced inside the handler
        onConditionApplied({
          id: 'necromancer.scourge.condition',
          handler: scourgeResolverEventReactions.condition
        })
      ]
    }
  },
  presentation: scourgeUi
});
