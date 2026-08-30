import { defineNativeModule } from '../../../../integrations/patches/authoring/profession.js';
import {
  onBuffApplied,
  onResolvedControl,
  onResolvedCriticalHit,
  onResolvedDamage
} from '../../../../integrations/patches/authoring/mechanics.js';
import { createRangerModuleData } from '../data/catalog.js';
import { rangerCoreSkillHandlers, rangerCoreSkillMechanicHandlers } from './skills/handlers.js';
import { rangerCoreAttributeRules, rangerCoreCastRules } from './traits/modifiers.js';
import { RANGER_CORE_BASE_SKILL_MECHANICS, RANGER_CORE_EXTRA_SKILLS } from './skills/index.js';
import { projectRangerEndState } from '../state/index.js';
import { createRangerCoreState } from './state.js';
import { bindRangerCoreUi } from './presentation.js';
import { rangerCoreEventHandlers, rangerCoreEventReactions } from './mechanics/reactions.js';
import { rangerCoreExecutionHooks } from './mechanics/execution.js';
import { RANGER_CORE_BALANCE_PROFILES } from './profiles.js';

export const rangerCoreModule = defineNativeModule({
  id: 'Core',
  data: createRangerModuleData('Core', {
    skillMechanics: RANGER_CORE_BASE_SKILL_MECHANICS,
    balanceProfiles: RANGER_CORE_BALANCE_PROFILES,
    extraSkills: RANGER_CORE_EXTRA_SKILLS
  }),
  state: {
    scheduler: createRangerCoreState,
    resolver: createRangerCoreState,
    project: projectRangerEndState
  },
  mechanics: {
    modifiers: rangerCoreAttributeRules,
    execution: {
      skillHandlers: rangerCoreSkillHandlers,
      castRules: rangerCoreCastRules,
      skillMechanicHandlers: rangerCoreSkillMechanicHandlers,
      hooks: rangerCoreExecutionHooks
    },
    resolution: {
      hooks: { eventHandlers: rangerCoreEventHandlers },
      reactions: [
        ...rangerCoreEventReactions.critical.map(onResolvedCriticalHit),
        ...rangerCoreEventReactions.damage.map(onResolvedDamage),
        ...rangerCoreEventReactions.control.map(onResolvedControl),
        ...rangerCoreEventReactions.buff.map(onBuffApplied)
      ]
    }
  },
  presentation: bindRangerCoreUi
});
