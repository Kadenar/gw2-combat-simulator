import { ELEMENTALIST_CORE_PROFILE_FIELDS } from '#gw2/professions/elementalist/core/catalog-fields.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { elementalistCoreHooks } from '#gw2/professions/elementalist/core/hooks.js';
import { hammerOrbModifiers } from '#gw2/professions/elementalist/core/mechanics/hammer-orbs.js';
import { frostBowDurationModifier } from '#gw2/professions/elementalist/core/mechanics/conjures.js';
import { bindElementalistCoreUi } from '#gw2/professions/elementalist/core/presentation.js';
import { elementalistSkillAttributes } from '#gw2/professions/elementalist/core/skills/attributes.js';
import {
  ELEMENTALIST_CORE_EXTRA_SKILLS,
  ELEMENTALIST_CORE_SKILL_MECHANICS
} from '#gw2/professions/elementalist/core/skills/index.js';
import {
  createElementalistCoreState,
  projectElementalistCorePlanningState
} from '#gw2/professions/elementalist/core/state.js';
import { elementalistCoreTraits } from '#gw2/professions/elementalist/core/traits/index.js';
import { createElementalistModuleData } from '#gw2/professions/elementalist/data/module-data.js';
import { ELEMENTALIST_CORE_SKILL_FIELDS } from '#gw2/professions/elementalist/core/catalog-fields.js';

/**
 * Core Elementalist module: binds the shared attunement/endurance state, its
 * live cast and impact hooks, and the Core UI into one registration
 * that every Elementalist specialization builds on.
 */
export const elementalistCoreModule = defineNativeModule({
  attributes: elementalistSkillAttributes,
  canSwapWeaponSetsInCombat: false,
  id: 'Core',
  data: createElementalistModuleData('Core', {
    profileFields: ELEMENTALIST_CORE_PROFILE_FIELDS,
    skillFields: ELEMENTALIST_CORE_SKILL_FIELDS,
    skillMechanics: ELEMENTALIST_CORE_SKILL_MECHANICS,
    extraSkills: ELEMENTALIST_CORE_EXTRA_SKILLS
  }),
  state: {
    create: createElementalistCoreState,
    project: projectElementalistCorePlanningState
  },
  traitDefinitions: elementalistCoreTraits,
  // Preserve resource-rule ordering while each mechanic owns its declarations.
  modifiers: [...hammerOrbModifiers, frostBowDurationModifier],
  hooks: elementalistCoreHooks,
  presentation: bindElementalistCoreUi
});
