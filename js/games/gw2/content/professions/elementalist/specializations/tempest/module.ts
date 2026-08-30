/**
 * Tempest module wiring.
 *
 * Assembles the specialization's catalog data, per-run state, overload cast rules and
 * scheduler hooks, shout handler, aura resolver reaction, and skill-bar presentation into
 * the single native module the elementalist family registers.
 */
import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { onAuraApplied } from '#gw2/integrations/patches/authoring/mechanics.js';
import { createElementalistModuleData } from '#gw2/content/professions/elementalist/catalog/module-data.js';
import {
  tempestAttributeRules,
  tempestCastRules,
  tempestSchedulerHooks
} from '#gw2/content/professions/elementalist/specializations/tempest/mechanics/overloads.js';
import { createTempestState } from '#gw2/content/professions/elementalist/specializations/tempest/state.js';
import { tempestUi } from '#gw2/content/professions/elementalist/specializations/tempest/presentation.js';
import { TEMPEST_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/specializations/tempest/skills/index.js';
import { applyTempestResolverAura } from '#gw2/content/professions/elementalist/specializations/tempest/mechanics/aura-effects.js';
import { tempestSkillHandlers } from '#gw2/content/professions/elementalist/specializations/tempest/skills/execution.js';
import { TEMPEST_BALANCE_PROFILES } from '#gw2/content/professions/elementalist/specializations/tempest/profiles.js';

/** The Tempest specialization module consumed by the elementalist module registry. */
export const tempestModule = defineNativeModule({
  id: 'Tempest',
  data: createElementalistModuleData('Tempest', {
    skillMechanics: TEMPEST_SKILL_MECHANICS,
    balanceProfiles: TEMPEST_BALANCE_PROFILES
  }),
  state: { scheduler: createTempestState, resolver: createTempestState },
  mechanics: {
    modifiers: tempestAttributeRules,
    execution: {
      skillHandlers: tempestSkillHandlers,
      castRules: tempestCastRules,
      hooks: tempestSchedulerHooks
    },
    resolution: {
      reactions: [
        onAuraApplied({
          id: 'elementalist.tempest-aura',
          handler: applyTempestResolverAura
        })
      ]
    }
  },
  presentation: tempestUi
});
