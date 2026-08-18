import {
  defineNativeModule,
  onAuraApplied,
  onConditionApplied,
  onResolvedDamage
} from '../../../platform/gw2/native-profession.js';
import { createElementalistModuleData } from '../catalog-data.js';
import { elementalistCoreAttributeRules, elementalistCoreCastRules, elementalistCoreSchedulerHooks } from './rules.js';
import { createElementalistCoreState, projectElementalistEndState } from './state.js';
import { bindElementalistCoreUi } from './ui.js';
import { ELEMENTALIST_CORE_EXTRA_SKILLS, ELEMENTALIST_CORE_SKILL_MECHANICS } from './skills.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILES } from './profiles.js';
import {
  applyElementalistResolverAttunement,
  applyElementalistResolverAura,
  applyElementalistResolverSignetFire,
  applyElementalistResolvedCondition,
  applyElementalistResolvedDamage
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
    schedulerHooks: elementalistCoreSchedulerHooks,
    reactions: [
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
