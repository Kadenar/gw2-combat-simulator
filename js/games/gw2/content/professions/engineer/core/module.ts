import { defineNativeModule } from '../../../../integrations/patches/authoring/profession.js';
import {
  onConditionApplied,
  onResolvedCriticalHit,
  onResolvedDamage
} from '../../../../integrations/patches/authoring/mechanics.js';
import { createEngineerModuleData } from '../data/catalog.js';
import { ENGINEER_SKILL_IDS as ID } from '../data/ids.js';
import { engineerCoreSkillHandlers } from './handlers.js';
import {
  engineerCoreAttributeRules,
  engineerCoreCastRules,
  engineerCoreSchedulerHooks,
  snapshotEngineerState
} from './rules.js';
import { engineerCoreResolverEventHandlers, engineerCoreResolverEventReactions } from './resolver.js';
import { ENGINEER_CORE_EXTRA_SKILLS, ENGINEER_CORE_SKILL_MECHANICS, ENGINEER_TURRET_ATTACK_SKILLS } from './skills.js';
import { createEngineerCoreState } from './state.js';
import { projectEngineerEndState } from '../state/index.js';
import { ENGINEER_CORE_BALANCE_PROFILES } from './profiles.js';
import { bindEngineerCoreUi } from './presentation.js';
import type { EngineerSchedulerContext } from '../types.js';

export const engineerCoreModule = defineNativeModule({
  id: 'Core',
  data: createEngineerModuleData('Core', {
    skillMechanics: ENGINEER_CORE_SKILL_MECHANICS,
    balanceProfiles: ENGINEER_CORE_BALANCE_PROFILES,
    extraSkills: [...ENGINEER_CORE_EXTRA_SKILLS, ...ENGINEER_TURRET_ATTACK_SKILLS],
    handlers: engineerCoreSkillHandlers,
    // RIFLE_BURST_GRENADE is a sub-packet of Rifle Burst, not a standalone chain member
    autoattackChains: { excludeSkillIds: [ID.RIFLE_BURST_GRENADE] }
  }),
  state: {
    // scheduler and resolver each need an independent initial state instance
    scheduler: createEngineerCoreState,
    resolver: createEngineerCoreState,
    project: projectEngineerEndState
  },
  mechanics: {
    modifiers: engineerCoreAttributeRules,
    castRules: engineerCoreCastRules,
    schedulerHooks: {
      ...engineerCoreSchedulerHooks,
      // snapshot wraps snapshotEngineerState to match the hook signature (context → state)
      snapshot: (context: EngineerSchedulerContext) => snapshotEngineerState(context.state.profession)
    },
    reactions: [
      // Authoring helpers adapt profession declarations to platform reaction hooks.
      ...engineerCoreResolverEventReactions.critical.map(onResolvedCriticalHit),
      ...engineerCoreResolverEventReactions.damage.map(onResolvedDamage),
      ...engineerCoreResolverEventReactions.condition.map(onConditionApplied)
    ],
    resolverHooks: {
      eventHandlers: engineerCoreResolverEventHandlers
    }
  },
  presentation: bindEngineerCoreUi
});
