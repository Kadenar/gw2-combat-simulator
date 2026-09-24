import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { onResolvingDamage } from '#gw2/platform/profession-definition/mechanics.js';
import { createThiefModuleData } from '#gw2/professions/thief/data/module-data.js';
import { thiefCoreEventHandlers, thiefCoreEventReactions } from '#gw2/professions/thief/core/mechanics/reactions.js';
import {
  thiefCoreAttributeRules,
  thiefCoreCastRules,
  modifyThiefLifeSiphon
} from '#gw2/professions/thief/core/traits/modifiers.js';
import { createThiefCoreState } from '#gw2/professions/thief/core/state.js';
import { projectThiefPlanningState } from '#gw2/professions/thief/family-state.js';
import { thiefCoreUi } from '#gw2/professions/thief/core/presentation.js';
import { THIEF_CORE_EXTRA_SKILLS, THIEF_CORE_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/index.js';
import { thiefCoreSkillHandlers } from '#gw2/professions/thief/core/execution/index.js';
import { THIEF_CORE_BALANCE_PROFILES } from '#gw2/professions/thief/core/profiles.js';
import { thiefCoreSchedulerHooks } from '#gw2/professions/thief/core/execution/hooks.js';
import { thiefEndurance, thiefInitiative } from '#gw2/professions/thief/core/mechanics/resources.js';

export const thiefCoreModule = defineNativeModule({
  id: 'Core',
  data: createThiefModuleData('Core', {
    skillMechanics: THIEF_CORE_SKILL_MECHANICS,
    balanceProfiles: THIEF_CORE_BALANCE_PROFILES,
    extraSkills: THIEF_CORE_EXTRA_SKILLS
  }),
  resources: { endurance: thiefEndurance, initiative: thiefInitiative },
  state: {
    scheduler: createThiefCoreState,
    resolver: createThiefCoreState,
    project: projectThiefPlanningState
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
        onResolvingDamage({ id: 'thief.life-siphon', handler: modifyThiefLifeSiphon }),
        ...thiefCoreEventReactions
      ],
      hooks: {
        eventHandlers: thiefCoreEventHandlers
      }
    }
  },
  presentation: thiefCoreUi
});
