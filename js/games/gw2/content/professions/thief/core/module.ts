import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import {
  onBuffApplied,
  onConditionApplied,
  onResolvedCriticalHit,
  onResolvedDamage
} from '#gw2/integrations/patches/authoring/mechanics.js';
import { createThiefModuleData } from '#gw2/content/professions/thief/catalog/module-data.js';
import {
  thiefCoreEventHandlers,
  thiefCoreEventReactions
} from '#gw2/content/professions/thief/core/mechanics/reactions.js';
import {
  thiefCoreAttributeRules,
  thiefCoreCastRules,
  thiefCoreSchedulerHooks
} from '#gw2/content/professions/thief/core/traits/modifiers.js';
import { createThiefCoreState } from '#gw2/content/professions/thief/core/state.js';
import { projectThiefEndState } from '#gw2/content/professions/thief/state.js';
import { thiefCoreUi } from '#gw2/content/professions/thief/core/presentation.js';
import {
  THIEF_CORE_EXTRA_SKILLS,
  THIEF_CORE_SKILL_MECHANICS
} from '#gw2/content/professions/thief/core/skills/index.js';
import { thiefCoreSkillHandlers } from '#gw2/content/professions/thief/core/skills/execution.js';
import { THIEF_CORE_BALANCE_PROFILES } from '#gw2/content/professions/thief/core/profiles.js';

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
