import { defineNativeModule, onConditionApplied } from '../../../../platform/gw2/native-profession.js';
import { createNecromancerModuleData } from '../../catalog-data.js';
import { scourgeSkillHandlers } from './handlers.js';
import { scourgeResolverEventReactions } from './resolver.js';
import { scourgeAttributeRules, scourgeCastRules } from './rules.js';
import { scourgeState } from './state.js';
import { scourgeUi } from './ui.js';
import { SCOURGE_BASE_SKILL_MECHANICS } from './skills.js';
import { SCOURGE_BALANCE_PROFILES } from './profiles.js';

export const scourgeModule = defineNativeModule({
  id: 'Scourge',
  data: createNecromancerModuleData('Scourge', {
    skillMechanics: SCOURGE_BASE_SKILL_MECHANICS,
    balanceProfiles: SCOURGE_BALANCE_PROFILES,
    handlers: scourgeSkillHandlers
  }),
  state: { scheduler: scourgeState.create, resolver: scourgeState.create },
  mechanics: {
    modifiers: scourgeAttributeRules,
    castRules: scourgeCastRules,
    reactions: [
      // Demonic Lore fires on every Torment application; ICD is enforced inside the handler
      onConditionApplied({
        id: 'necromancer.scourge.condition',
        handler: scourgeResolverEventReactions.condition
      })
    ]
  },
  presentation: scourgeUi
});
