import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { onResolvedBlind, onResolvedControl } from '#gw2/platform/profession-definition/mechanics.js';
import { createMesmerModuleData } from '#gw2/professions/mesmer/data/module-data.js';
import { mesmerCoreEventHandlers, mesmerCoreEventReactions } from '#gw2/professions/mesmer/core/mechanics/reactions.js';
import { completeMimicCast } from '#gw2/professions/mesmer/core/mechanics/mimic.js';
import { mesmerCastRules } from '#gw2/professions/mesmer/core/mechanics/recharge.js';
import { mesmerCoreSignetSkillMechanicHandlers } from '#gw2/professions/mesmer/core/mechanics/signets.js';
import { mesmerCoreRifleSkillMechanicHandlers } from '#gw2/professions/mesmer/core/mechanics/rifle.js';
import { scheduleChaosStormPoison } from '#gw2/professions/mesmer/core/mechanics/chaos-storm.js';
import { mesmerCoreAttributeRules } from '#gw2/professions/mesmer/core/traits/modifiers.js';
import { createMesmerCoreResolverState, createMesmerCoreState } from '#gw2/professions/mesmer/core/state.js';
import { projectMesmerPlanningState, snapshotMesmerState } from '#gw2/professions/mesmer/family-state.js';
import { mesmerCoreUi } from '#gw2/professions/mesmer/core/presentation.js';
import { MESMER_CORE_EXTRA_SKILLS } from '#gw2/professions/mesmer/core/skills/actions.js';
import { MESMER_CORE_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/index.js';
import { MESMER_CORE_SUPPLEMENTAL_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/supplemental-skills.js';
import { mesmerCoreSkillHandlers } from '#gw2/professions/mesmer/core/execution/index.js';
import { MESMER_CORE_BALANCE_PROFILES } from '#gw2/professions/mesmer/core/profiles.js';
import type { MesmerSchedulerContext } from '#gw2/professions/mesmer/types.js';
import { mesmerCoreSchedulerHooks } from '#gw2/professions/mesmer/core/execution/hooks.js';

export const mesmerCoreModule = defineNativeModule({
  id: 'Core',
  data: createMesmerModuleData('Core', {
    skillMechanics: MESMER_CORE_SKILL_MECHANICS,
    supplementalSkillMechanics: MESMER_CORE_SUPPLEMENTAL_SKILL_MECHANICS,
    extraSkills: MESMER_CORE_EXTRA_SKILLS,
    balanceProfiles: MESMER_CORE_BALANCE_PROFILES
  }),
  state: {
    scheduler: createMesmerCoreState,
    resolver: createMesmerCoreResolverState,
    project: projectMesmerPlanningState
  },
  mechanics: {
    modifiers: mesmerCoreAttributeRules,
    execution: {
      skillHandlers: mesmerCoreSkillHandlers,
      castRules: mesmerCastRules,
      // Mimic observes completed casts after Core has committed their cooldown and ammo state.
      castLifecycle: [
        {
          phase: 'scheduler',
          hook: 'onCastComplete',
          id: 'mesmer.core.mimic',
          order: 50,
          handler: completeMimicCast
        }
      ],
      skillMechanicHandlers: {
        ...mesmerCoreSignetSkillMechanicHandlers,
        ...mesmerCoreRifleSkillMechanicHandlers,
        'mesmer.core.chaos-storm-poison': scheduleChaosStormPoison
      },
      hooks: {
        ...mesmerCoreSchedulerHooks,
        snapshot: (context: MesmerSchedulerContext) => snapshotMesmerState(context.state.profession)
      }
    },
    resolution: {
      reactions: [
        onResolvedControl({
          id: 'mesmer.core.control',
          handler: mesmerCoreEventReactions.control
        }),
        onResolvedBlind({
          id: 'mesmer.core.blind',
          handler: mesmerCoreEventReactions.blind
        })
      ],
      hooks: {
        eventHandlers: mesmerCoreEventHandlers
      }
    }
  },
  presentation: mesmerCoreUi
});
