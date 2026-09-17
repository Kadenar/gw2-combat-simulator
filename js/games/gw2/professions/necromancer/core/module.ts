import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import {
  onConditionApplied,
  onResolvedBlind,
  onResolvedControl,
  onResolvedDamage
} from '#gw2/platform/profession-definition/mechanics.js';
import { createNecromancerModuleData } from '#gw2/professions/necromancer/data/module-data.js';
import {
  necromancerCoreAttributeRules,
  necromancerCoreCastRules
} from '#gw2/professions/necromancer/core/traits/modifiers.js';
import {
  necromancerCoreResolverEventHandlers,
  necromancerCoreResolverEventReactions
} from '#gw2/professions/necromancer/core/mechanics/reactions.js';
import { createNecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import { projectNecromancerEndState, snapshotNecromancerState } from '#gw2/professions/necromancer/family-state.js';
import { bindNecromancerCoreUi } from '#gw2/professions/necromancer/core/presentation.js';
import {
  NECROMANCER_CORE_BASE_SKILL_MECHANICS,
  NECROMANCER_CORE_EXTRA_SKILLS
} from '#gw2/professions/necromancer/core/skills/index.js';
import { necromancerCoreSkillHandlers } from '#gw2/professions/necromancer/core/execution/index.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILES } from '#gw2/professions/necromancer/core/profiles.js';
import type { NecromancerSchedulerContext } from '#gw2/professions/necromancer/types.js';
import { necromancerGreatswordSkillMechanicHandlers } from '#gw2/professions/necromancer/core/execution/greatsword.js';
import { necromancerSchedulerHooks } from '#gw2/professions/necromancer/core/execution/hooks.js';

export const necromancerCoreModule = defineNativeModule({
  id: 'Core',
  data: createNecromancerModuleData('Core', {
    skillMechanics: NECROMANCER_CORE_BASE_SKILL_MECHANICS,
    extraSkills: NECROMANCER_CORE_EXTRA_SKILLS,
    balanceProfiles: NECROMANCER_CORE_BALANCE_PROFILES,
    autoattackChains: {
      // The API does not link Echo to the omitted final step, so declare the complete in-game sequence explicitly.
      additional: [[ID.ENERVATION_BLADE, ID.ENERVATION_ECHO, ID.DEATHLY_ENERVATION]]
    }
  }),
  state: {
    scheduler: createNecromancerCoreState,
    resolver: createNecromancerCoreState,
    project: projectNecromancerEndState
  },
  mechanics: {
    modifiers: necromancerCoreAttributeRules,
    execution: {
      skillHandlers: necromancerCoreSkillHandlers,
      castRules: necromancerCoreCastRules,
      skillMechanicHandlers: necromancerGreatswordSkillMechanicHandlers,
      hooks: {
        ...necromancerSchedulerHooks,
        snapshot: (context: NecromancerSchedulerContext) => snapshotNecromancerState(context.state.profession)
      }
    },
    resolution: {
      hooks: { eventHandlers: necromancerCoreResolverEventHandlers },
      reactions: [
        ...necromancerCoreResolverEventReactions.damage.map(onResolvedDamage),
        ...necromancerCoreResolverEventReactions.blind.map(onResolvedBlind),
        ...necromancerCoreResolverEventReactions.control.map(onResolvedControl),
        ...necromancerCoreResolverEventReactions.condition.map(onConditionApplied)
      ]
    }
  },
  presentation: bindNecromancerCoreUi
});
