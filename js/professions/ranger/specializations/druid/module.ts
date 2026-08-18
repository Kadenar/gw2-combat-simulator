import {
  defineNativeModule,
  onConditionApplied,
  onResolvedControl
} from '../../../../platform/gw2/native-profession.js';
import { createRangerModuleData } from '../../catalog-data.js';
import { druidSkillHandlers } from './handlers.js';
import { druidAttributeRules, druidCastRules, druidSchedulerHooks } from './rules.js';
import { reactToDruidCondition, reactToDruidControl } from './resolver.js';
import { DRUID_BASE_SKILL_MECHANICS } from './skills.js';
import { druidState } from './state.js';
import { druidUi } from './ui.js';
import { DRUID_BALANCE_PROFILES } from './profiles.js';

export const druidModule = defineNativeModule({
  id: 'Druid',
  data: createRangerModuleData('Druid', {
    skillMechanics: DRUID_BASE_SKILL_MECHANICS,
    balanceProfiles: DRUID_BALANCE_PROFILES,
    handlers: druidSkillHandlers
  }),
  // Same state factory for both phases: resolver reads celestialAvatarActive and astralForce during damage resolution
  state: { scheduler: druidState.create, resolver: druidState.create },
  mechanics: {
    modifiers: druidAttributeRules,
    castRules: druidCastRules,
    schedulerHooks: druidSchedulerHooks,
    reactions: [
      // Blood Moon procs on any control effect (from reactToDruidControl) and specifically on Immobilize conditions (from reactToDruidCondition)
      onResolvedControl({
        id: 'ranger.druid-control',
        order: 20,
        handler: reactToDruidControl
      }),
      onConditionApplied({
        id: 'ranger.druid-condition',
        order: 20,
        handler: reactToDruidCondition
      })
    ]
  },
  presentation: druidUi
});
