import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import {
  onConditionApplied,
  onResolvedCriticalHit,
  onResolvedDamage
} from '#gw2/integrations/patches/authoring/mechanics.js';
import { createEngineerModuleData } from '#gw2/content/professions/engineer/catalog/module-data.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import { engineerCoreSkillHandlers } from '#gw2/content/professions/engineer/core/skills/execution.js';
import {
  engineerCoreAttributeRules,
  engineerCoreCastRules,
  engineerCoreSchedulerHooks,
  snapshotEngineerState
} from '#gw2/content/professions/engineer/core/traits/modifiers.js';
import {
  engineerCoreResolverEventHandlers,
  engineerCoreResolverEventReactions
} from '#gw2/content/professions/engineer/core/mechanics/reactions.js';
import {
  ENGINEER_CORE_EXTRA_SKILLS,
  ENGINEER_CORE_SKILL_MECHANICS
} from '#gw2/content/professions/engineer/core/skills/index.js';
import { createEngineerCoreState } from '#gw2/content/professions/engineer/core/state.js';
import { projectEngineerEndState } from '#gw2/content/professions/engineer/state.js';
import { ENGINEER_CORE_BALANCE_PROFILES } from '#gw2/content/professions/engineer/core/profiles.js';
import { bindEngineerCoreUi } from '#gw2/content/professions/engineer/core/presentation.js';
import type { EngineerSchedulerContext } from '#gw2/content/professions/engineer/types.js';

export const engineerCoreModule = defineNativeModule({
  id: 'Core',
  data: createEngineerModuleData('Core', {
    skillMechanics: ENGINEER_CORE_SKILL_MECHANICS,
    balanceProfiles: ENGINEER_CORE_BALANCE_PROFILES,
    extraSkills: ENGINEER_CORE_EXTRA_SKILLS,
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
    execution: {
      skillHandlers: engineerCoreSkillHandlers,
      castRules: engineerCoreCastRules,
      hooks: {
        ...engineerCoreSchedulerHooks,
        // snapshot wraps snapshotEngineerState to match the hook signature (context → state)
        snapshot: (context: EngineerSchedulerContext) => snapshotEngineerState(context.state.profession)
      }
    },
    resolution: {
      reactions: [
        // Authoring helpers adapt profession declarations to platform reaction hooks.
        ...engineerCoreResolverEventReactions.critical.map(onResolvedCriticalHit),
        ...engineerCoreResolverEventReactions.damage.map(onResolvedDamage),
        ...engineerCoreResolverEventReactions.condition.map(onConditionApplied)
      ],
      hooks: {
        eventHandlers: engineerCoreResolverEventHandlers
      }
    }
  },
  presentation: bindEngineerCoreUi
});
