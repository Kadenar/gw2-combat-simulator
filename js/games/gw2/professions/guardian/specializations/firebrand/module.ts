import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { skillAvailability } from '#gw2/platform/profession-definition/mechanics.js';
import { createGuardianModuleData } from '#gw2/professions/guardian/data/module-data.js';
import { firebrandSkillHandlers } from '#gw2/professions/guardian/specializations/firebrand/execution/index.js';
import {
  firebrandEventHandlers,
  firebrandEventReactions
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/tome-effects.js';
import {
  firebrandAttributeRules,
  firebrandCastRules,
  firebrandSchedulerHooks
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/tomes-and-mantras.js';
import { FIREBRAND_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/firebrand/skills/index.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { bindFirebrandUi } from '#gw2/professions/guardian/specializations/firebrand/presentation.js';
import { FIREBRAND_BALANCE_PROFILES } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';

export const firebrandModule = defineNativeModule({
  id: 'Firebrand',
  data: createGuardianModuleData('Firebrand', {
    skillMechanics: FIREBRAND_SKILL_MECHANICS,
    balanceProfiles: FIREBRAND_BALANCE_PROFILES
  }),
  state: {
    // Scheduler and resolver each get their own independent copy of the same
    // factory; the two contexts never share a live state object.
    scheduler: firebrandState.create,
    resolver: firebrandState.create
  },
  mechanics: {
    modifiers: firebrandAttributeRules,
    execution: {
      skillHandlers: firebrandSkillHandlers,
      availability: firebrandCastRules.availability.map(skillAvailability),
      hooks: firebrandSchedulerHooks
    },
    resolution: {
      reactions: firebrandEventReactions,
      hooks: {
        eventHandlers: firebrandEventHandlers
      }
    }
  },
  presentation: bindFirebrandUi
});
