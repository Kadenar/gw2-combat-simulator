import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import {
  augmentSkill,
  onBuffApplied,
  onResolvedDamage,
  replaceSkill,
  skillAvailability
} from '#gw2/platform/profession-definition/mechanics.js';
import { createGuardianModuleData } from '#gw2/professions/guardian/catalog/module-data.js';
import { guardianTomeSkillHandlers } from '#gw2/professions/guardian/specializations/firebrand/mechanics/tomes.js';
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
import { firebrandUi } from '#gw2/professions/guardian/specializations/firebrand/presentation.js';
import { FIREBRAND_BALANCE_PROFILES } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';

/** Accounts for tome pages while preserving authored tome effects. */
const firebrandSkillHandlers = Object.freeze({
  'guardian.stow-tome': replaceSkill({
    beforeEffects: guardianTomeSkillHandlers['guardian.stow-tome']
  }),
  'guardian.tome-page': augmentSkill({
    beforeEffects: guardianTomeSkillHandlers['guardian.tome-page']
  })
});

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
      reactions: [
        ...firebrandEventReactions.damage.map(onResolvedDamage),
        ...firebrandEventReactions.buff.map(onBuffApplied)
      ],
      hooks: {
        eventHandlers: firebrandEventHandlers
      }
    }
  },
  presentation: firebrandUi
});
