import { afterSkillEffects, onResolvingDamage } from '#gw2/platform/profession-definition/mechanics.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createEngineerModuleData } from '#gw2/professions/engineer/data/module-data.js';
import { holosmithSkillHandlers } from '#gw2/professions/engineer/specializations/holosmith/execution/index.js';
import {
  consumeSolarFocusingLens,
  holosmithResolverEventHandlers
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/photon-forge-effects.js';
import {
  holosmithAdvancedSchedulerHooks,
  holosmithAfterCast,
  holosmithAttributeRules,
  holosmithCastRules
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/photon-forge-rules.js';
import {
  HOLOSMITH_AUTOATTACK_CHAINS,
  HOLOSMITH_SKILL_MECHANICS
} from '#gw2/professions/engineer/specializations/holosmith/skills/index.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { HOLOSMITH_BALANCE_PROFILES } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';
import { bindHolosmithUi } from '#gw2/professions/engineer/specializations/holosmith/presentation.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

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
      reactions: [onResolvingDamage({ id: 'engineer.solar-focusing-lens', handler: consumeSolarFocusingLens })],
      hooks: { eventHandlers: holosmithResolverEventHandlers }
    }
  },
  presentation: bindHolosmithUi
});
