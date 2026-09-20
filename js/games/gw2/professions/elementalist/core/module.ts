import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import {
  onAuraApplied,
  onBuffApplied,
  onConditionApplied,
  onResolvedDamage
} from '#gw2/platform/profession-definition/mechanics.js';
import { createElementalistModuleData } from '#gw2/professions/elementalist/data/module-data.js';
import {
  elementalistCoreSkillHandlers,
  elementalistCoreSkillMechanicHandlers
} from '#gw2/professions/elementalist/core/execution/index.js';
import { elementalistCoreCastRules } from '#gw2/professions/elementalist/core/mechanics/recharge.js';
import { elementalistCoreAttributeRules } from '#gw2/professions/elementalist/core/traits/modifiers.js';
import { projectElementalistPlanningState } from '#gw2/professions/elementalist/family-state.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { bindElementalistCoreUi } from '#gw2/professions/elementalist/core/presentation.js';
import {
  ELEMENTALIST_CORE_EXTRA_SKILLS,
  ELEMENTALIST_CORE_SKILL_MECHANICS
} from '#gw2/professions/elementalist/core/skills/index.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILES } from '#gw2/professions/elementalist/core/profiles.js';
import {
  applyElementalistResolverAttunement,
  applyElementalistResolverAura,
  applyElementalistResolverBuff,
  applyElementalistResolverSignetFire,
  applyElementalistResolvedCondition,
  applyElementalistResolvedDamage,
  elementalistCoreCriticalReactions
} from '#gw2/professions/elementalist/core/mechanics/reactions.js';
import { elementalistCoreSchedulerHooks } from '#gw2/professions/elementalist/core/execution/hooks.js';
import { applyElementalistResolverConjure } from '#gw2/professions/elementalist/core/mechanics/conjures.js';

/**
 * Core Elementalist module: binds the shared attunement/endurance state, its
 * cast, scheduler, and resolver hooks, and the Core UI into one registration
 * that every Elementalist specialization builds on.
 */
export const elementalistCoreModule = defineNativeModule({
  id: 'Core',
  data: createElementalistModuleData('Core', {
    skillMechanics: ELEMENTALIST_CORE_SKILL_MECHANICS,
    extraSkills: ELEMENTALIST_CORE_EXTRA_SKILLS,
    balanceProfiles: ELEMENTALIST_CORE_BALANCE_PROFILES
  }),
  state: {
    scheduler: createElementalistCoreState,
    resolver: createElementalistCoreState,
    project: projectElementalistPlanningState
  },
  mechanics: {
    modifiers: elementalistCoreAttributeRules,
    execution: {
      skillHandlers: elementalistCoreSkillHandlers,
      castRules: elementalistCoreCastRules,
      skillMechanicHandlers: elementalistCoreSkillMechanicHandlers,
      hooks: elementalistCoreSchedulerHooks
    },
    resolution: {
      reactions: [
        ...elementalistCoreCriticalReactions,
        onResolvedDamage({
          id: 'elementalist.core.damage',
          handler: applyElementalistResolvedDamage
        }),
        onConditionApplied({
          id: 'elementalist.core.condition',
          handler: applyElementalistResolvedCondition
        }),
        onBuffApplied({
          id: 'elementalist.core.buff',
          handler: applyElementalistResolverBuff
        }),
        onAuraApplied({
          id: 'elementalist.core-aura',
          handler: applyElementalistResolverAura
        })
      ],
      hooks: {
        // The resolver throws on any event type without a registered handler,
        // so the marker-only scheduler events (Fresh Air, Evasive Arcana,
        // attunement entry) are registered as explicit no-ops.
        eventHandlers: {
          'elementalist.conjure': applyElementalistResolverConjure,
          'elementalist.attunement': applyElementalistResolverAttunement,
          'elementalist.aura': applyElementalistResolverAura,
          'elementalist.fresh-air': () => {},
          'elementalist.evasive-arcana': () => {},
          'elementalist.attunement-enter': () => {},
          'elementalist.signet-fire': applyElementalistResolverSignetFire
        }
      }
    }
  },
  presentation: bindElementalistCoreUi
});
