import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { onResolvingDamage } from '#gw2/platform/profession-definition/mechanics.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/data/module-data.js';
import { revenantCoreEventHandlers } from '#gw2/professions/revenant/core/mechanics/state-events.js';
import {
  revenantCoreAttributeRules,
  modifyRevenantLifeSiphon,
  revenantCastRules
} from '#gw2/professions/revenant/core/traits/modifiers.js';
import { createRevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import { projectRevenantPlanningState } from '#gw2/professions/revenant/family-state.js';
import { revenantCoreUi } from '#gw2/professions/revenant/core/presentation.js';
import {
  REVENANT_CORE_BASE_SKILL_MECHANICS,
  REVENANT_CORE_EXTRA_SKILLS
} from '#gw2/professions/revenant/core/skills/index.js';
import { REVENANT_CORE_BALANCE_PROFILES } from '#gw2/professions/revenant/core/profiles.js';
import { revenantCoreSkillHandlers } from '#gw2/professions/revenant/core/execution/index.js';
import { revenantSchedulerHooks } from '#gw2/professions/revenant/core/execution/hooks.js';
import { revenantEndurance, revenantEnergy } from '#gw2/professions/revenant/core/mechanics/energy.js';

export const revenantCoreModule = defineNativeModule({
  id: 'Core',
  data: createRevenantModuleData('Core', {
    skillMechanics: REVENANT_CORE_BASE_SKILL_MECHANICS,
    extraSkills: REVENANT_CORE_EXTRA_SKILLS,
    balanceProfiles: REVENANT_CORE_BALANCE_PROFILES
  }),
  resources: { endurance: revenantEndurance, energy: revenantEnergy },
  state: {
    scheduler: createRevenantCoreState,
    resolver: createRevenantCoreState,
    project: projectRevenantPlanningState
  },
  mechanics: {
    modifiers: revenantCoreAttributeRules,
    execution: {
      skillHandlers: revenantCoreSkillHandlers,
      castRules: revenantCastRules,
      hooks: revenantSchedulerHooks
    },
    resolution: {
      reactions: [onResolvingDamage({ id: 'revenant.life-siphon', handler: modifyRevenantLifeSiphon })],
      hooks: {
        eventHandlers: revenantCoreEventHandlers
      }
    }
  },
  presentation: revenantCoreUi
});
