import { defineNativeModule } from '../../../../integrations/patches/authoring/profession.js';
import { onBuffApplied, onResolvedDamage } from '../../../../integrations/patches/authoring/mechanics.js';
import { createWarriorModuleData } from '../data/catalog.js';
import {
  WARRIOR_CORE_SKILL_MECHANICS,
  WARRIOR_DODGE,
  WARRIOR_SWAP_WEAPONS,
  WARRIOR_WEAPON_STOW
} from './skills/index.js';
import { warriorCoreSkillHandlers } from './skills/handlers.js';
import { warriorCoreSkillMechanicHandlers } from './traits/index.js';
import { warriorCoreAttributeRules, warriorCoreCastRules, warriorCoreSchedulerHooks } from './traits/modifiers.js';
import { createWarriorCoreState } from './state.js';
import { projectWarriorEndState, snapshotWarriorState } from '../state/index.js';
import { bindWarriorCoreUi } from './presentation.js';
import type { WarriorSchedulerContext } from '../types.js';
import { warriorCoreEventHandlers, warriorCoreEventReactions } from './mechanics/reactions.js';
import { WARRIOR_CORE_BALANCE_PROFILES } from './profiles.js';

export const warriorCoreModule = defineNativeModule({
  id: 'Core',
  data: createWarriorModuleData('Core', {
    skillMechanics: WARRIOR_CORE_SKILL_MECHANICS,
    balanceProfiles: WARRIOR_CORE_BALANCE_PROFILES,
    extraSkills: [WARRIOR_DODGE, WARRIOR_SWAP_WEAPONS, WARRIOR_WEAPON_STOW]
  }),
  state: {
    scheduler: createWarriorCoreState,
    resolver: createWarriorCoreState,
    project: projectWarriorEndState
  },
  mechanics: {
    modifiers: warriorCoreAttributeRules,
    execution: {
      skillHandlers: warriorCoreSkillHandlers,
      castRules: warriorCoreCastRules,
      skillMechanicHandlers: warriorCoreSkillMechanicHandlers,
      hooks: {
        ...warriorCoreSchedulerHooks,
        snapshot: (context: WarriorSchedulerContext) => snapshotWarriorState(context.state.profession)
      }
    },
    resolution: {
      hooks: {
        eventHandlers: warriorCoreEventHandlers
      },
      reactions: [
        ...warriorCoreEventReactions.damage.map(onResolvedDamage),
        ...warriorCoreEventReactions.buff.map(onBuffApplied)
      ]
    }
  },
  presentation: bindWarriorCoreUi
});
