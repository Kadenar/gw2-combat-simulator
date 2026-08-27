import { defineNativeModule } from '../../../../integrations/patches/authoring/profession.js';
import {
  onConditionApplied,
  onResolvedBlind,
  onResolvedControl,
  onResolvedDamage
} from '../../../../integrations/patches/authoring/mechanics.js';
import { createNecromancerModuleData } from '../catalog-data.js';
import {
  necromancerCoreAttributeRules,
  necromancerCoreCastRules,
  necromancerCoreSkillMechanicHandlers,
  necromancerSchedulerHooks,
  snapshotNecromancerState
} from './rules.js';
import { necromancerCoreResolverEventHandlers, necromancerCoreResolverEventReactions } from './resolver.js';
import { createNecromancerCoreState } from './state.js';
import { projectNecromancerEndState } from '../state.js';
import { bindNecromancerCoreUi } from './ui.js';
import { NECROMANCER_CORE_BASE_SKILL_MECHANICS, NECROMANCER_CORE_EXTRA_SKILLS } from './skills.js';
import { necromancerCoreSkillHandlers } from './handlers.js';
import { NECROMANCER_SKILL_IDS as ID } from '../data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILES } from './profiles.js';
import type { NecromancerSchedulerContext } from '../types.js';

export const necromancerCoreModule = defineNativeModule({
  id: 'Core',
  data: createNecromancerModuleData('Core', {
    skillMechanics: NECROMANCER_CORE_BASE_SKILL_MECHANICS,
    extraSkills: NECROMANCER_CORE_EXTRA_SKILLS,
    balanceProfiles: NECROMANCER_CORE_BALANCE_PROFILES,
    handlers: necromancerCoreSkillHandlers,
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
    castRules: necromancerCoreCastRules,
    skillMechanicHandlers: necromancerCoreSkillMechanicHandlers,
    schedulerHooks: {
      ...necromancerSchedulerHooks,
      snapshot: (context: NecromancerSchedulerContext) => snapshotNecromancerState(context.state.profession)
    },
    resolverHooks: { eventHandlers: necromancerCoreResolverEventHandlers },
    reactions: [
      ...necromancerCoreResolverEventReactions.damage.map(onResolvedDamage),
      ...necromancerCoreResolverEventReactions.blind.map(onResolvedBlind),
      ...necromancerCoreResolverEventReactions.control.map(onResolvedControl),
      ...necromancerCoreResolverEventReactions.condition.map(onConditionApplied)
    ]
  },
  presentation: bindNecromancerCoreUi
});
