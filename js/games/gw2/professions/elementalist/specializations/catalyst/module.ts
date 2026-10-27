import { ELEMENTALIST_CATALYST_PROFILE_FIELDS } from '#gw2/professions/elementalist/specializations/catalyst/catalog-fields.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { createElementalistModuleData } from '#gw2/professions/elementalist/data/module-data.js';
import { catalystHooks } from '#gw2/professions/elementalist/specializations/catalyst/hooks.js';
import { catalystUi } from '#gw2/professions/elementalist/specializations/catalyst/presentation.js';
import { relentlessFireModifiers } from '#gw2/professions/elementalist/specializations/catalyst/skills/augment-skills.js';
import { CATALYST_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/catalyst/skills/index.js';
import {
  CATALYST_PUBLIC_STATE_PROJECTION,
  catalystState
} from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { catalystTraits } from '#gw2/professions/elementalist/specializations/catalyst/traits/index.js';

/**
 * Assembles the Catalyst specialization module: skill data and traits,
 * the live Catalyst state, the energy and
 * Elemental Empowerment mechanics, and the accepted-event reactions that turn auras,
 * combo finishers, control effects and buff applications into Catalyst trait procs.
 */
export const catalystModule = defineNativeModule({
  id: 'Catalyst',
  traitDefinitions: catalystTraits,
  data: createElementalistModuleData('Catalyst', {
    profileFields: ELEMENTALIST_CATALYST_PROFILE_FIELDS,
    skillMechanics: CATALYST_SKILL_MECHANICS
  }),
  state: { create: catalystState.create, project: createPublicStateProjector(CATALYST_PUBLIC_STATE_PROJECTION) },
  // Register the skill/mechanic-owned rules alongside trait declarations.
  modifiers: relentlessFireModifiers,
  hooks: catalystHooks,
  presentation: catalystUi
});
