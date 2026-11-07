/**
 * Assembles the Tempest module registered by the Elementalist family. Includes catalog data, per-run state,
 * overload cast rules and deadlines, shout completion, aura reactions, and skill-bar presentation.
 */
import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { TRAIT_LINES } from '#gw2/professions/elementalist/data/trait-lines.js';
import { tempestHooks } from '#gw2/professions/elementalist/specializations/tempest/hooks.js';
import { tempestUi } from '#gw2/professions/elementalist/specializations/tempest/presentation.js';
import { TEMPEST_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/tempest/skills/index.js';
import { tempestState } from '#gw2/professions/elementalist/specializations/tempest/state.js';
import { tempestTraits } from '#gw2/professions/elementalist/specializations/tempest/traits/index.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** The Tempest specialization module consumed by the elementalist module registry. */
export const tempestModule = defineNativeModule({
  id: 'Tempest',
  data: createNativeModuleData<ElementalistSkill>({
    id: 'Tempest',
    traitLines: TRAIT_LINES,
    skills: materializeSkillDefinitions(TEMPEST_SKILL_MECHANICS)
  }),
  state: { create: tempestState.create },
  traitDefinitions: tempestTraits,
  hooks: tempestHooks,
  presentation: tempestUi
});
