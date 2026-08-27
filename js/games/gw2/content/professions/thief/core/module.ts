import { defineNativeModule } from '../../../../integrations/patches/authoring/profession.js';
import {
  onBuffApplied,
  onConditionApplied,
  onResolvedCriticalHit,
  onResolvedDamage
} from '../../../../integrations/patches/authoring/mechanics.js';
import { createThiefModuleData } from '../catalog-data.js';
import { thiefCoreEventHandlers, thiefCoreEventReactions } from './resolver.js';
import { thiefCoreAttributeRules, thiefCoreCastRules, thiefCoreSchedulerHooks } from './rules.js';
import { createThiefCoreState } from './state.js';
import { projectThiefEndState } from '../state.js';
import { thiefCoreUi } from './ui.js';
import { THIEF_CORE_EXTRA_SKILLS, THIEF_CORE_SKILL_MECHANICS } from './skills.js';
import { thiefCoreSkillHandlers } from './handlers.js';
import { THIEF_CORE_BALANCE_PROFILES } from './profiles.js';

export const thiefCoreModule = defineNativeModule({
  id: 'Core',
  data: createThiefModuleData('Core', {
    skillMechanics: THIEF_CORE_SKILL_MECHANICS,
    balanceProfiles: THIEF_CORE_BALANCE_PROFILES,
    extraSkills: THIEF_CORE_EXTRA_SKILLS,
    handlers: thiefCoreSkillHandlers
  }),
  state: {
    scheduler: createThiefCoreState,
    resolver: createThiefCoreState,
    project: projectThiefEndState
  },
  mechanics: {
    modifiers: thiefCoreAttributeRules,
    castRules: thiefCoreCastRules,
    schedulerHooks: thiefCoreSchedulerHooks,
    reactions: [
      ...thiefCoreEventReactions.critical.map(onResolvedCriticalHit),
      ...thiefCoreEventReactions.damage.map(onResolvedDamage),
      ...thiefCoreEventReactions.condition.map(onConditionApplied),
      ...thiefCoreEventReactions.buff.map(onBuffApplied)
    ],
    resolverHooks: {
      eventHandlers: thiefCoreEventHandlers
    }
  },
  presentation: thiefCoreUi
});
