import { defineNativeModule } from '../../../../integrations/patches/authoring/profession.js';
import { onBuffApplied, onResolvedDamage } from '../../../../integrations/patches/authoring/mechanics.js';
import { createGuardianModuleData } from '../data/catalog.js';
import { guardianCoreSkillHandlers } from './skills/handlers.js';
import { guardianCoreEventHandlers, guardianCoreEventReactions } from './mechanics/reactions.js';
import { guardianCoreAttributeRules, guardianCoreCastRules } from './traits/modifiers.js';
import { guardianCoreExecutionHooks } from './mechanics/execution.js';
import { GUARDIAN_CORE_EXTRA_SKILLS, GUARDIAN_CORE_SKILL_MECHANICS } from './skills/index.js';
import { createGuardianCoreState } from './state.js';
import { projectGuardianEndState, snapshotGuardianState } from '../state/index.js';
import { bindGuardianCoreUi } from './presentation.js';
import type { GuardianSchedulerContext } from '../types.js';
import { GUARDIAN_CORE_BALANCE_PROFILES } from './profiles.js';

export const guardianCoreModule = defineNativeModule({
  id: 'Core',
  data: createGuardianModuleData('Core', {
    skillMechanics: GUARDIAN_CORE_SKILL_MECHANICS,
    extraSkills: GUARDIAN_CORE_EXTRA_SKILLS,
    balanceProfiles: GUARDIAN_CORE_BALANCE_PROFILES
  }),
  state: {
    scheduler: createGuardianCoreState,
    resolver: createGuardianCoreState,
    project: projectGuardianEndState
  },
  mechanics: {
    modifiers: guardianCoreAttributeRules,
    execution: {
      skillHandlers: guardianCoreSkillHandlers,
      castRules: guardianCoreCastRules,
      hooks: {
        ...guardianCoreExecutionHooks,
        snapshot: (context: GuardianSchedulerContext) => snapshotGuardianState(context.state.profession)
      }
    },
    resolution: {
      reactions: [
        ...guardianCoreEventReactions.damage.map(onResolvedDamage),
        ...guardianCoreEventReactions.buff.map(onBuffApplied)
      ],
      hooks: {
        eventHandlers: guardianCoreEventHandlers
      }
    }
  },
  presentation: bindGuardianCoreUi
});
