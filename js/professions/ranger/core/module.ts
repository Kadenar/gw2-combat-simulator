import {
  defineNativeModule,
  onBuffApplied,
  onResolvedControl,
  onResolvedDamage,
  onResolvedPlayerCriticalHit
} from '../../../platform/gw2/native-profession.js';
import { createRangerModuleData } from '../catalog-data.js';
import { rangerCoreSkillHandlers } from './handlers.js';
import {
  rangerCoreAttributeRules,
  rangerCoreCastRules,
  rangerCoreSchedulerHooks,
  rangerCoreSkillMechanicHandlers
} from './rules.js';
import { RANGER_CORE_BASE_SKILL_MECHANICS, RANGER_CORE_EXTRA_SKILLS } from './skills.js';
import { projectRangerEndState } from '../state.js';
import { createRangerCoreState } from './state.js';
import { bindRangerCoreUi } from './ui.js';
import { rangerCoreEventHandlers, rangerCoreEventReactions } from './resolver.js';
import { RANGER_CORE_BALANCE_PROFILES } from './profiles.js';

export const rangerCoreModule = defineNativeModule({
  id: 'Core',
  data: createRangerModuleData('Core', {
    skillMechanics: RANGER_CORE_BASE_SKILL_MECHANICS,
    balanceProfiles: RANGER_CORE_BALANCE_PROFILES,
    extraSkills: RANGER_CORE_EXTRA_SKILLS,
    handlers: rangerCoreSkillHandlers
  }),
  state: {
    scheduler: createRangerCoreState,
    resolver: createRangerCoreState,
    project: projectRangerEndState
  },
  mechanics: {
    modifiers: rangerCoreAttributeRules,
    castRules: rangerCoreCastRules,
    skillMechanicHandlers: rangerCoreSkillMechanicHandlers,
    schedulerHooks: rangerCoreSchedulerHooks,
    resolverHooks: { eventHandlers: rangerCoreEventHandlers },
    reactions: [
      ...rangerCoreEventReactions.critical.map(onResolvedPlayerCriticalHit),
      ...rangerCoreEventReactions.damage.map(onResolvedDamage),
      ...rangerCoreEventReactions.control.map(onResolvedControl),
      ...rangerCoreEventReactions.buff.map(onBuffApplied)
    ]
  },
  presentation: bindRangerCoreUi
});
