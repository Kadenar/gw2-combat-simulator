import { afterSkillEffects, defineNativeModule } from '../../../../platform/gw2/native-profession.js';
import { createEngineerModuleData } from '../../catalog-data.js';
import { holosmithSkillHandlers } from './handlers.js';
import { holosmithResolverEventHandlers } from './resolver.js';
import {
  holosmithAdvancedSchedulerHooks,
  holosmithAfterCast,
  holosmithAttributeRules,
  holosmithCastRules
} from './rules.js';
import { HOLOSMITH_SKILL_MECHANICS } from './skills.js';
import { holosmithState } from './state.js';
import { HOLOSMITH_BALANCE_PROFILES } from './profiles.js';
import { bindHolosmithUi } from './ui.js';
import { ENGINEER_SKILL_IDS as ID } from '../../data/ids.js';

// Declare both Photon Forge autoattack variants through the catalog contract so
// scheduling and the shared palette projector advance the same chain state.
const HOLOSMITH_AUTOATTACK_CHAINS = Object.freeze([
  Object.freeze([ID.LIGHT_STRIKE, ID.BRIGHT_SLASH, ID.FLASH_CUTTER]),
  Object.freeze([ID.LIGHT_STRIKE_STORM, ID.BRIGHT_SLASH_STORM, ID.FLASH_CUTTER_STORM])
]);

export const holosmithModule = defineNativeModule({
  id: 'Holosmith',
  data: createEngineerModuleData('Holosmith', {
    skillMechanics: HOLOSMITH_SKILL_MECHANICS,
    balanceProfiles: HOLOSMITH_BALANCE_PROFILES,
    handlers: holosmithSkillHandlers,
    autoattackChains: { additional: HOLOSMITH_AUTOATTACK_CHAINS }
  }),
  // Scheduler and resolver share the same state factory so heat values are consistent
  // when the resolver reads them during damage attribution.
  state: { scheduler: holosmithState.create, resolver: holosmithState.create },
  mechanics: {
    modifiers: holosmithAttributeRules,
    castRules: holosmithCastRules,
    castLifecycle: [afterSkillEffects(holosmithAfterCast)],
    schedulerHooks: holosmithAdvancedSchedulerHooks,
    resolverHooks: { eventHandlers: holosmithResolverEventHandlers }
  },
  presentation: bindHolosmithUi
});
