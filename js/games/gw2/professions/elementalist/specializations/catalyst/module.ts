import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import {
  onAuraApplied,
  onComboResolved,
  onBuffApplied,
  onConditionApplied,
  onResolvedControl,
  onResolvedDamage
} from '#gw2/platform/profession-definition/mechanics.js';
import { createElementalistModuleData } from '#gw2/professions/elementalist/catalog/module-data.js';
import {
  applyCatalystEmpowerment,
  applyCatalystComboTraits,
  applyCatalystResolverAura,
  applyCatalystResolvedDamage,
  applyViciousEmpowerment
} from '#gw2/professions/elementalist/specializations/catalyst/mechanics/reactions.js';
import {
  catalystAttributeRules,
  catalystCastRules,
  catalystSchedulerHooks,
  catalystSkillMechanicHandlers
} from '#gw2/professions/elementalist/specializations/catalyst/mechanics/jade-sphere-and-empowerment.js';
import { createCatalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { catalystUi } from '#gw2/professions/elementalist/specializations/catalyst/presentation.js';
import { CATALYST_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/catalyst/skills/index.js';
import { CATALYST_BALANCE_PROFILES } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';

/**
 * Assembles the Catalyst specialization module: Jade Sphere skill data and balance
 * profiles, the shared scheduler/resolver Catalyst state, the energy and
 * Elemental Empowerment mechanics, and the resolver reactions that turn auras,
 * combo finishers, control effects and buff applications into Catalyst trait procs.
 */
export const catalystModule = defineNativeModule({
  id: 'Catalyst',
  data: createElementalistModuleData('Catalyst', {
    skillMechanics: CATALYST_SKILL_MECHANICS,
    balanceProfiles: CATALYST_BALANCE_PROFILES
  }),
  state: { scheduler: createCatalystState, resolver: createCatalystState },
  mechanics: {
    modifiers: catalystAttributeRules,
    execution: {
      castRules: catalystCastRules,
      skillMechanicHandlers: catalystSkillMechanicHandlers,
      hooks: catalystSchedulerHooks
    },
    resolution: {
      reactions: [
        onAuraApplied({
          id: 'elementalist.catalyst-aura',
          handler: applyCatalystResolverAura
        }),
        onResolvedDamage({
          id: 'elementalist.catalyst-shattering-ice',
          handler: applyCatalystResolvedDamage
        }),
        onBuffApplied({
          id: 'elementalist.catalyst-empowerment',
          handler: applyCatalystEmpowerment
        }),
        onResolvedControl({
          id: 'elementalist.catalyst-vicious-empowerment-control',
          handler: applyViciousEmpowerment
        }),
        onConditionApplied({
          id: 'elementalist.catalyst-vicious-empowerment-immobilize',
          handler: applyViciousEmpowerment
        }),
        onComboResolved({
          id: 'elementalist.catalyst-combo-traits',
          handler: applyCatalystComboTraits
        })
      ]
    }
  },
  presentation: catalystUi
});
