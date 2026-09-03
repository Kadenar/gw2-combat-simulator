import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import {
  onBuffApplied,
  onConditionApplied,
  onResolvedControl,
  onResolvedDamage
} from '#gw2/platform/profession-definition/mechanics.js';
import { createRangerModuleData } from '#gw2/professions/ranger/catalog/module-data.js';
import { soulbeastSkillHandlers } from '#gw2/professions/ranger/specializations/soulbeast/execution/index.js';
import {
  soulbeastAttributeRules,
  soulbeastCastRules,
  soulbeastSchedulerHooks
} from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode.js';
import { SOULBEAST_BASE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/index.js';
import { soulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import { bindSoulbeastUi } from '#gw2/professions/ranger/specializations/soulbeast/presentation.js';
import {
  reactToRangerWinterBite,
  reactToSoulbeastBuff,
  reactToSoulbeastCondition,
  reactToSoulbeastControl,
  reactToSoulbeastDamage,
  soulbeastEventHandlers
} from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { SOULBEAST_BALANCE_PROFILES } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';

export const soulbeastModule = defineNativeModule({
  id: 'Soulbeast',
  data: createRangerModuleData('Soulbeast', {
    skillMechanics: SOULBEAST_BASE_SKILL_MECHANICS,
    balanceProfiles: SOULBEAST_BALANCE_PROFILES
  }),
  // Scheduler and resolver each get their own independent state instance — they run in separate phases.
  state: { scheduler: soulbeastState.create, resolver: soulbeastState.create },
  mechanics: {
    modifiers: soulbeastAttributeRules,
    execution: {
      skillHandlers: soulbeastSkillHandlers,
      castRules: soulbeastCastRules,
      hooks: soulbeastSchedulerHooks
    },
    resolution: {
      hooks: { eventHandlers: soulbeastEventHandlers },
      reactions: [
        onResolvedDamage({
          id: 'ranger.soulbeast-damage',
          order: 20,
          handler: reactToSoulbeastDamage
        }),
        // Winter's Bite runs at order 30 so it fires after the main damage reaction (order 20) has already processed the hit.
        onResolvedDamage({
          id: 'ranger.winters-bite',
          order: 30,
          handler: reactToRangerWinterBite
        }),
        onResolvedControl({
          id: 'ranger.soulbeast-control',
          order: 20,
          handler: reactToSoulbeastControl
        }),
        onConditionApplied({
          id: 'ranger.soulbeast-condition',
          order: 20,
          handler: reactToSoulbeastCondition
        }),
        onBuffApplied({
          id: 'ranger.soulbeast-buff',
          order: 20,
          handler: reactToSoulbeastBuff
        })
      ]
    }
  },
  presentation: bindSoulbeastUi
});
