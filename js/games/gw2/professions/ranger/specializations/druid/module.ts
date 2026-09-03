import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { onConditionApplied, onResolvedControl } from '#gw2/platform/profession-definition/mechanics.js';
import { createRangerModuleData } from '#gw2/professions/ranger/catalog/module-data.js';
import {
  applyCelestialAvatarTraits,
  druidAttributeRules,
  druidCastRules,
  druidSchedulerHooks
} from '#gw2/professions/ranger/specializations/druid/mechanics/celestial-avatar-rules.js';
import { enterAvatar, leaveAvatar } from '#gw2/professions/ranger/specializations/druid/mechanics/celestial-avatar.js';
import {
  reactToDruidCondition,
  reactToDruidControl
} from '#gw2/professions/ranger/specializations/druid/traits/blood-moon.js';
import { DRUID_BASE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/druid/skills/index.js';
import { druidState } from '#gw2/professions/ranger/specializations/druid/state.js';
import { druidUi } from '#gw2/professions/ranger/specializations/druid/presentation.js';
import { DRUID_BALANCE_PROFILES } from '#gw2/professions/ranger/specializations/druid/profiles.js';
import type { RangerCastContext, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Applies Celestial Avatar transitions after the corresponding native cast. */
const druidSkillHandlers = Object.freeze({
  'ranger.celestial-avatar-enter': {
    mode: 'augment' as const,
    afterEffects: enterAvatar
  },
  'ranger.celestial-avatar-exit': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      leaveAvatar(context, false, context.effectiveEnd, skill);
    }
  },
  'ranger.celestial-avatar-skill': {
    mode: 'augment' as const,
    afterEffects: applyCelestialAvatarTraits
  }
});

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
