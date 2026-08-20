import { defineNativeModule, onBuffApplied, onResolvedDamage } from '../../../platform/gw2/native-profession.js';
import { createWarriorModuleData } from '../catalog-data.js';
import { WARRIOR_CORE_SKILL_MECHANICS, WARRIOR_DODGE, WARRIOR_SWAP_WEAPONS } from './skills.js';
import { warriorCoreSkillHandlers } from './handlers.js';
import { warriorCoreSkillMechanicHandlers } from './traits.js';
import {
  warriorCoreAttributeRules,
  warriorCoreCastRules,
  warriorCoreSchedulerHooks,
  snapshotWarriorState
} from './rules.js';
import { createWarriorCoreState, projectWarriorEndState } from './state.js';
import { bindWarriorCoreUi } from './ui.js';
import type { WarriorSchedulerContext } from '../types.js';
import { warriorCoreEventHandlers, warriorCoreEventReactions } from './resolver.js';
import { WARRIOR_CORE_BALANCE_PROFILES } from './profiles.js';

export const warriorCoreModule = defineNativeModule({
  id: 'Core',
  data: createWarriorModuleData('Core', {
    skillMechanics: WARRIOR_CORE_SKILL_MECHANICS,
    balanceProfiles: WARRIOR_CORE_BALANCE_PROFILES,
    extraSkills: [WARRIOR_DODGE, WARRIOR_SWAP_WEAPONS],
    handlers: warriorCoreSkillHandlers
  }),
  state: {
    scheduler: createWarriorCoreState,
    resolver: createWarriorCoreState,
    project: projectWarriorEndState
  },
  mechanics: {
    modifiers: warriorCoreAttributeRules,
    castRules: warriorCoreCastRules,
    skillMechanicHandlers: warriorCoreSkillMechanicHandlers,
    schedulerHooks: {
      ...warriorCoreSchedulerHooks,
      snapshot: (context: WarriorSchedulerContext) => snapshotWarriorState(context.state.profession)
    },
    resolverHooks: {
      eventHandlers: warriorCoreEventHandlers
    },
    reactions: [
      ...warriorCoreEventReactions.damage.map(onResolvedDamage),
      ...warriorCoreEventReactions.buff.map(onBuffApplied)
    ]
  },
  presentation: bindWarriorCoreUi
});
