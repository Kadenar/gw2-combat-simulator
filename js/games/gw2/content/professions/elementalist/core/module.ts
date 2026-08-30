import { defineNativeModule } from '../../../../integrations/patches/authoring/profession.js';
import {
  onAuraApplied,
  onConditionApplied,
  onResolvedDamage
} from '../../../../integrations/patches/authoring/mechanics.js';
import { createElementalistModuleData } from '../data/catalog.js';
import {
  elementalistCoreAttributeRules,
  elementalistCoreCastRules,
  elementalistCoreSchedulerHooks,
  elementalistCoreSkillMechanicHandlers
} from './rules.js';
import { projectElementalistEndState } from '../state/index.js';
import { createElementalistCoreState } from './state.js';
import { bindElementalistCoreUi } from './presentation.js';
import { ELEMENTALIST_CORE_EXTRA_SKILLS, ELEMENTALIST_CORE_SKILL_MECHANICS } from './skills.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILES } from './profiles.js';
import {
  applyElementalistResolverAttunement,
  applyElementalistResolverAura,
  applyElementalistResolverSignetFire,
  applyElementalistResolvedCondition,
  applyElementalistResolvedDamage,
  elementalistCoreCriticalReactions
} from './resolver.js';

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
    project: projectElementalistEndState
  },
  mechanics: {
    modifiers: elementalistCoreAttributeRules,
    castRules: elementalistCoreCastRules,
    skillMechanicHandlers: elementalistCoreSkillMechanicHandlers,
    schedulerHooks: elementalistCoreSchedulerHooks,
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
      onAuraApplied({
        id: 'elementalist.core-aura',
        handler: applyElementalistResolverAura
      })
    ],
    resolverHooks: {
      eventHandlers: {
        'elementalist.attunement': applyElementalistResolverAttunement,
        'elementalist.aura': applyElementalistResolverAura,
        'elementalist.fresh-air': () => {},
        'elementalist.evasive-arcana': () => {},
        'elementalist.attunement-enter': () => {},
        'elementalist.signet-fire': applyElementalistResolverSignetFire
      }
    }
  },
  presentation: bindElementalistCoreUi
});
