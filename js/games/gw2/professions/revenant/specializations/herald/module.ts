import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { TRAIT_LINES } from '#gw2/professions/revenant/data/trait-lines.js';
import { heraldAttributes } from '#gw2/professions/revenant/specializations/herald/attributes.js';
import {
  HERALD_SKILL_FIELDS,
  REVENANT_HERALD_PROFILE_FIELDS
} from '#gw2/professions/revenant/specializations/herald/catalog-fields.js';
import { heraldHooks } from '#gw2/professions/revenant/specializations/herald/hooks.js';
import { heraldUi } from '#gw2/professions/revenant/specializations/herald/presentation.js';
import {
  burstOfStrengthModifiers,
  HERALD_BASE_SKILL_MECHANICS
} from '#gw2/professions/revenant/specializations/herald/skills/index.js';
import { REVENANT_HERALD_SKILL_FLIPS } from '#gw2/professions/revenant/specializations/herald/skills/skill-flips.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import { traitDefinitions } from '#gw2/professions/revenant/specializations/herald/traits/index.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const heraldModule = defineNativeModule({
  traitDefinitions,
  id: 'Herald',
  data: createNativeModuleData<RevenantSkill>({
    id: 'Herald',
    traitLines: TRAIT_LINES,
    skillFlips: REVENANT_HERALD_SKILL_FLIPS,
    profileFields: REVENANT_HERALD_PROFILE_FIELDS,
    skillFields: HERALD_SKILL_FIELDS,
    skills: materializeSkillDefinitions(HERALD_BASE_SKILL_MECHANICS)
  }),
  state: { create: heraldState.create },
  attributes: heraldAttributes,
  // Register the skill/mechanic-owned rules alongside trait declarations.
  modifiers: burstOfStrengthModifiers,
  hooks: heraldHooks,
  presentation: heraldUi
});
