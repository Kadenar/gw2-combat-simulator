import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createGuardianModuleData } from '#gw2/professions/guardian/data/module-data.js';
import { luminarySkillHandlers } from '#gw2/professions/guardian/specializations/luminary/execution/index.js';
import {
  luminaryEventHandlers,
  luminaryEventReactions
} from '#gw2/professions/guardian/specializations/luminary/mechanics/radiant-forge-effects.js';
import {
  luminaryAttributeRules,
  luminaryCastRules,
  luminarySchedulerHooks,
  luminarySkillMechanicHandlers
} from '#gw2/professions/guardian/specializations/luminary/mechanics/radiant-forge-rules.js';
import {
  LUMINARY_EXTRA_SKILLS,
  LUMINARY_SKILL_MECHANICS
} from '#gw2/professions/guardian/specializations/luminary/skills/index.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import { luminaryUi } from '#gw2/professions/guardian/specializations/luminary/presentation.js';
import { LUMINARY_BALANCE_PROFILES } from '#gw2/professions/guardian/specializations/luminary/profiles.js';

export const luminaryModule = defineNativeModule({
  id: 'Luminary',
  data: createGuardianModuleData('Luminary', {
    skillMechanics: LUMINARY_SKILL_MECHANICS,
    extraSkills: LUMINARY_EXTRA_SKILLS,
    balanceProfiles: LUMINARY_BALANCE_PROFILES
  }),
  state: {
    // Both scheduler and resolver get independent state instances; the resolver
    // rebuilds its view by replaying timeline events rather than sharing a
    // reference with the scheduler.
    scheduler: luminaryState.create,
    resolver: luminaryState.create
  },
  mechanics: {
    modifiers: luminaryAttributeRules,
    execution: {
      skillHandlers: luminarySkillHandlers,
      castRules: luminaryCastRules,
      skillMechanicHandlers: luminarySkillMechanicHandlers,
      hooks: luminarySchedulerHooks
    },
    resolution: {
      reactions: luminaryEventReactions,
      hooks: { eventHandlers: luminaryEventHandlers }
    }
  },
  presentation: luminaryUi
});
