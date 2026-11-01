import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { TRAIT_LINES } from '#gw2/professions/guardian/data/trait-lines.js';
import { dragonhunterHooks } from '#gw2/professions/guardian/specializations/dragonhunter/hooks.js';
import { bindDragonhunterUi } from '#gw2/professions/guardian/specializations/dragonhunter/presentation.js';
import { DRAGONHUNTER_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/dragonhunter/skills/index.js';
import { GUARDIAN_DRAGONHUNTER_SKILL_FLIPS } from '#gw2/professions/guardian/specializations/dragonhunter/skills/skill-flips.js';
import {
  dragonhunterState,
  projectDragonhunterPlanningState
} from '#gw2/professions/guardian/specializations/dragonhunter/state.js';
import { dragonhunterTraits } from '#gw2/professions/guardian/specializations/dragonhunter/traits/index.js';
import type { GuardianSkill } from '#gw2/professions/guardian/types.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const dragonhunterModule = defineNativeModule({
  id: 'Dragonhunter',
  data: createNativeModuleData<GuardianSkill>({
    id: 'Dragonhunter',
    traitLines: TRAIT_LINES,
    skillFlips: GUARDIAN_DRAGONHUNTER_SKILL_FLIPS,
    skillMechanics: DRAGONHUNTER_SKILL_MECHANICS
  }),
  state: {
    create: dragonhunterState.create,
    project: projectDragonhunterPlanningState
  },
  traitDefinitions: dragonhunterTraits,
  hooks: dragonhunterHooks,
  presentation: bindDragonhunterUi
});
