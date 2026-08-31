import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { onConditionApplied, onResolvedControl } from '#gw2/integrations/patches/authoring/mechanics.js';
import { createRangerModuleData } from '#gw2/content/professions/ranger/catalog/module-data.js';
import { druidSkillHandlers } from '#gw2/content/professions/ranger/specializations/druid/skills/execution.js';
import {
  druidAttributeRules,
  druidCastRules,
  druidSchedulerHooks
} from '#gw2/content/professions/ranger/specializations/druid/mechanics/celestial-avatar-rules.js';
import {
  reactToDruidCondition,
  reactToDruidControl
} from '#gw2/content/professions/ranger/specializations/druid/traits/blood-moon.js';
import { DRUID_BASE_SKILL_MECHANICS } from '#gw2/content/professions/ranger/specializations/druid/skills/index.js';
import { druidState } from '#gw2/content/professions/ranger/specializations/druid/state.js';
import { druidUi } from '#gw2/content/professions/ranger/specializations/druid/presentation.js';
import { DRUID_BALANCE_PROFILES } from '#gw2/content/professions/ranger/specializations/druid/profiles.js';

export const druidModule = defineNativeModule({
  id: 'Druid',
  data: createRangerModuleData('Druid', {
    skillMechanics: DRUID_BASE_SKILL_MECHANICS,
    balanceProfiles: DRUID_BALANCE_PROFILES
  }),
  // Same state factory for both phases: resolver reads celestialAvatarActive and astralForce during damage resolution
  state: { scheduler: druidState.create, resolver: druidState.create },
  mechanics: {
    modifiers: druidAttributeRules,
    execution: {
      skillHandlers: druidSkillHandlers,
      castRules: druidCastRules,
      hooks: druidSchedulerHooks
    },
    resolution: {
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
    }
  },
  presentation: druidUi
});
