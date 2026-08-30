import { defineNativeModule } from '../../../../integrations/patches/authoring/profession.js';
import {
  onConditionApplied,
  onResolvedBlind,
  onResolvedControl,
  onResolvedDamage
} from '../../../../integrations/patches/authoring/mechanics.js';
import { createNecromancerModuleData } from '../data/catalog.js';
import { necromancerCoreAttributeRules, necromancerCoreCastRules } from './traits/modifiers.js';
import { necromancerCoreSkillMechanicHandlers, necromancerSchedulerHooks } from './mechanics/execution.js';
import { necromancerCoreResolverEventHandlers, necromancerCoreResolverEventReactions } from './mechanics/reactions.js';
import { createNecromancerCoreState } from './state.js';
import { projectNecromancerEndState, snapshotNecromancerState } from '../state/index.js';
import { bindNecromancerCoreUi } from './presentation.js';
import { NECROMANCER_CORE_BASE_SKILL_MECHANICS, NECROMANCER_CORE_EXTRA_SKILLS } from './skills/index.js';
import { necromancerCoreSkillHandlers } from './skills/handlers.js';
import { NECROMANCER_SKILL_IDS as ID } from '../data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILES } from './profiles.js';
import type { NecromancerSchedulerContext } from '../types.js';

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
      skillMechanicHandlers: necromancerCoreSkillMechanicHandlers,
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
