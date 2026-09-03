import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { onBuffApplied, onResolvedDamage } from '#gw2/integrations/patches/authoring/mechanics.js';
import { createWarriorModuleData } from '#gw2/content/professions/warrior/catalog/module-data.js';
import {
  WARRIOR_CORE_SKILL_MECHANICS,
  WARRIOR_DODGE,
  WARRIOR_SWAP_WEAPONS,
  WARRIOR_WEAPON_STOW
} from '#gw2/content/professions/warrior/core/skills/index.js';
import { warriorCoreSkillHandlers } from '#gw2/content/professions/warrior/core/execution/index.js';
import { warriorCoreSkillMechanicHandlers } from '#gw2/content/professions/warrior/core/traits/index.js';
import {
  warriorCoreAttributeRules,
  warriorCoreCastRules,
  warriorCoreSchedulerHooks
} from '#gw2/content/professions/warrior/core/traits/modifiers.js';
import { createWarriorCoreState } from '#gw2/content/professions/warrior/core/state.js';
import { projectWarriorEndState, snapshotWarriorState } from '#gw2/content/professions/warrior/state.js';
import { bindWarriorCoreUi } from '#gw2/content/professions/warrior/core/presentation.js';
import type { WarriorSchedulerContext } from '#gw2/content/professions/warrior/types.js';
import {
  warriorCoreEventHandlers,
  warriorCoreEventReactions
} from '#gw2/content/professions/warrior/core/mechanics/reactions.js';
import { WARRIOR_CORE_BALANCE_PROFILES } from '#gw2/content/professions/warrior/core/profiles.js';

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
