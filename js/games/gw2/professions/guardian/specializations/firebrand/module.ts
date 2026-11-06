import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { TRAIT_LINES } from '#gw2/professions/guardian/data/trait-lines.js';
import {
  FIREBRAND_SKILL_FIELDS,
  GUARDIAN_FIREBRAND_PROFILE_FIELDS
} from '#gw2/professions/guardian/specializations/firebrand/catalog-fields.js';
import { firebrandHooks } from '#gw2/professions/guardian/specializations/firebrand/hooks.js';
import { bindFirebrandUi } from '#gw2/professions/guardian/specializations/firebrand/presentation.js';
import { FIREBRAND_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/firebrand/skills/index.js';
import { GUARDIAN_FIREBRAND_SKILL_FLIPS } from '#gw2/professions/guardian/specializations/firebrand/skills/skill-flips.js';
import { ashesBurningSkill } from '#gw2/professions/guardian/specializations/firebrand/skills/tome-skills.js';
import {
  firebrandState,
  projectFirebrandPlanningState
} from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { firebrandTraits } from '#gw2/professions/guardian/specializations/firebrand/traits/index.js';
import type { GuardianSkill } from '#gw2/professions/guardian/types.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const firebrandModule = defineNativeModule({
  id: 'Firebrand',
  data: createNativeModuleData<GuardianSkill>({
    id: 'Firebrand',
    traitLines: TRAIT_LINES,
    skillFlips: GUARDIAN_FIREBRAND_SKILL_FLIPS,
    profileFields: GUARDIAN_FIREBRAND_PROFILE_FIELDS,

    skillFields: FIREBRAND_SKILL_FIELDS,
    skills: [...materializeSkillDefinitions(FIREBRAND_SKILL_MECHANICS), ashesBurningSkill]
  }),
  state: {
    // Initialize pages from the selected patch's compiled trait profiles.
    create: (config, { balanceContext }) => firebrandState.create({ config, catalog: balanceContext.catalog }),
    project: projectFirebrandPlanningState
  },
  traitDefinitions: firebrandTraits,
  hooks: firebrandHooks,
  presentation: bindFirebrandUi
});
