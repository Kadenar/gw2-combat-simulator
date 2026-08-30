import { defineNativeModule } from '../../../../integrations/patches/authoring/profession.js';
import {
  onBuffApplied,
  onConditionApplied,
  onResolvedCriticalHit,
  onResolvedDamage
} from '../../../../integrations/patches/authoring/mechanics.js';
import { createThiefModuleData } from '../data/catalog.js';
import { thiefCoreEventHandlers, thiefCoreEventReactions } from './mechanics/reactions.js';
import { thiefCoreAttributeRules, thiefCoreCastRules, thiefCoreSchedulerHooks } from './traits/modifiers.js';
import { createThiefCoreState } from './state.js';
import { projectThiefEndState } from '../state/index.js';
import { thiefCoreUi } from './presentation.js';
import { THIEF_CORE_EXTRA_SKILLS, THIEF_CORE_SKILL_MECHANICS } from './skills/index.js';
import { thiefCoreSkillHandlers } from './skills/handlers.js';
import { THIEF_CORE_BALANCE_PROFILES } from './profiles.js';

export const thiefCoreModule = defineNativeModule({
  id: 'Core',
  data: createThiefModuleData('Core', {
    skillMechanics: THIEF_CORE_SKILL_MECHANICS,
    balanceProfiles: THIEF_CORE_BALANCE_PROFILES,
    extraSkills: THIEF_CORE_EXTRA_SKILLS
  }),
  state: {
    scheduler: createThiefCoreState,
    resolver: createThiefCoreState,
    project: projectThiefEndState
  },
  mechanics: {
    modifiers: thiefCoreAttributeRules,
    execution: {
      skillHandlers: thiefCoreSkillHandlers,
      castRules: thiefCoreCastRules,
      hooks: thiefCoreSchedulerHooks
    },
    resolution: {
      reactions: [
        ...thiefCoreEventReactions.critical.map(onResolvedCriticalHit),
        ...thiefCoreEventReactions.damage.map(onResolvedDamage),
        ...thiefCoreEventReactions.condition.map(onConditionApplied),
        ...thiefCoreEventReactions.buff.map(onBuffApplied)
      ],
      hooks: {
        eventHandlers: thiefCoreEventHandlers
      }
    }
  },
  presentation: thiefCoreUi
});
