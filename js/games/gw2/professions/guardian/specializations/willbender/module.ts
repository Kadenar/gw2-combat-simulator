import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { TRAIT_LINES } from '#gw2/professions/guardian/data/trait-lines.js';
import { willbenderHooks } from '#gw2/professions/guardian/specializations/willbender/hooks.js';
import { bindWillbenderUi } from '#gw2/professions/guardian/specializations/willbender/presentation.js';
import { WILLBENDER_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/willbender/skills/index.js';
import { GUARDIAN_WILLBENDER_SKILL_FLIPS } from '#gw2/professions/guardian/specializations/willbender/skills/skill-flips.js';
import {
  projectWillbenderPlanningState,
  willbenderState
} from '#gw2/professions/guardian/specializations/willbender/state.js';
import { willbenderTraits } from '#gw2/professions/guardian/specializations/willbender/traits/index.js';
import type { GuardianSkill } from '#gw2/professions/guardian/types.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const willbenderModule = defineNativeModule({
  id: 'Willbender',
  data: createNativeModuleData<GuardianSkill>({
    id: 'Willbender',
    traitLines: TRAIT_LINES,
    skillFlips: GUARDIAN_WILLBENDER_SKILL_FLIPS,
    skillMechanics: WILLBENDER_SKILL_MECHANICS
  }),
  state: { create: willbenderState.create, project: projectWillbenderPlanningState },
  traitDefinitions: willbenderTraits,
  hooks: willbenderHooks,
  presentation: bindWillbenderUi
});
