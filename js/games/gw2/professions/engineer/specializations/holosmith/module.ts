import { afterSkillEffects, augmentSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createEngineerModuleData } from '#gw2/professions/engineer/catalog/module-data.js';
import { engineerPhotonForgeSkillHandlers } from '#gw2/professions/engineer/specializations/holosmith/mechanics/photon-forge.js';
import { holosmithResolverEventHandlers } from '#gw2/professions/engineer/specializations/holosmith/mechanics/photon-forge-effects.js';
import {
  holosmithAdvancedSchedulerHooks,
  holosmithAfterCast,
  holosmithAttributeRules,
  holosmithCastRules
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/photon-forge-rules.js';
import { HOLOSMITH_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/holosmith/skills/index.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { HOLOSMITH_BALANCE_PROFILES } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';
import { bindHolosmithUi } from '#gw2/professions/engineer/specializations/holosmith/presentation.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

// Declare both Photon Forge autoattack variants through the catalog contract so
// scheduling and the shared palette projector advance the same chain state.
const HOLOSMITH_AUTOATTACK_CHAINS = Object.freeze([
  Object.freeze([ID.LIGHT_STRIKE, ID.BRIGHT_SLASH, ID.FLASH_CUTTER]),
  Object.freeze([ID.LIGHT_STRIKE_STORM, ID.BRIGHT_SLASH_STORM, ID.FLASH_CUTTER_STORM])
]);

/** Applies Photon Forge lifecycle changes after the native skill effects run. */
const holosmithSkillHandlers = Object.freeze({
  'engineer.photon-forge-enter': augmentSkill({
    afterEffects: engineerPhotonForgeSkillHandlers['engineer.photon-forge-enter']
  }),
  'engineer.photon-forge-exit': augmentSkill({
    afterEffects: engineerPhotonForgeSkillHandlers['engineer.photon-forge-exit']
  }),
  'engineer.heat': augmentSkill({
    afterEffects: engineerPhotonForgeSkillHandlers['engineer.heat']
  })
});

export const holosmithModule = defineNativeModule({
  id: 'Holosmith',
  data: createEngineerModuleData('Holosmith', {
    skillMechanics: HOLOSMITH_SKILL_MECHANICS,
    balanceProfiles: HOLOSMITH_BALANCE_PROFILES,
    // Runtime name lookup must select the heat-aware identities over Core's non-Holosmith variants.
    skillNameOverrides: {
      'Radiant Arc': ID.RADIANT_ARC,
      'Sun Edge': ID.SUN_EDGE,
      'Sun Ripper': ID.SUN_RIPPER,
      'Gleam Saber': ID.GLEAM_SABER,
      'Refraction Cutter': ID.REFRACTION_CUTTER
    },
    autoattackChains: { additional: HOLOSMITH_AUTOATTACK_CHAINS }
  }),
  // Scheduler and resolver share the same state factory so heat values are consistent
  // when the resolver reads them during damage attribution.
  state: { scheduler: holosmithState.create, resolver: holosmithState.create },
  mechanics: {
    modifiers: holosmithAttributeRules,
    execution: {
      skillHandlers: holosmithSkillHandlers,
      castRules: holosmithCastRules,
      castLifecycle: [afterSkillEffects(holosmithAfterCast)],
      hooks: holosmithAdvancedSchedulerHooks
    },
    resolution: {
      hooks: { eventHandlers: holosmithResolverEventHandlers }
    }
  },
  presentation: bindHolosmithUi
});
