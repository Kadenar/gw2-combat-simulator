import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import {
  onAuraApplied,
  onComboResolved,
  onBuffApplied,
  onConditionApplied,
  onResolvedControl,
  onResolvedDamage
} from '../../../../../integrations/patches/authoring/mechanics.js';
import { createElementalistModuleData } from '../../data/catalog.js';
import {
  applyCatalystEmpowerment,
  applyCatalystComboTraits,
  applyCatalystResolverAura,
  applyCatalystResolvedDamage,
  applyViciousEmpowerment
} from './mechanics/reactions.js';
import {
  catalystAttributeRules,
  catalystCastRules,
  catalystSchedulerHooks,
  catalystSkillMechanicHandlers
} from './mechanics/jade-sphere-and-empowerment.js';
import { createCatalystState } from './state.js';
import { catalystUi } from './presentation.js';
import { CATALYST_SKILL_MECHANICS } from './skills/index.js';
import { CATALYST_BALANCE_PROFILES } from './profiles.js';

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
