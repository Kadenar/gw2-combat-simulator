import { createPublicStateProjector } from '#gw2/platform/engine/profession/state.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { elementalistCoreHooks } from '#gw2/professions/elementalist/core/hooks.js';
import { elementalistCoreModifiers } from '#gw2/professions/elementalist/core/modifiers.js';
import { bindElementalistCoreUi } from '#gw2/professions/elementalist/core/presentation.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILES } from '#gw2/professions/elementalist/core/profiles.js';
import {
  ELEMENTALIST_CORE_EXTRA_SKILLS,
  ELEMENTALIST_CORE_SKILL_MECHANICS
} from '#gw2/professions/elementalist/core/skills/index.js';
import {
  createElementalistCoreState,
  ELEMENTALIST_CORE_PUBLIC_STATE_PROJECTION
} from '#gw2/professions/elementalist/core/state.js';
import { elementalistCoreTraits } from '#gw2/professions/elementalist/core/traits/index.js';
import { createElementalistModuleData } from '#gw2/professions/elementalist/data/module-data.js';
/**
 * Core Elementalist module: binds the shared attunement/endurance state, its
 * live cast and impact hooks, and the Core UI into one registration
 * that every Elementalist specialization builds on.
 */
export const elementalistCoreModule = defineNativeModule({
  id: 'Core',
  data: createElementalistModuleData('Core', {
    skillMechanics: ELEMENTALIST_CORE_SKILL_MECHANICS,
    extraSkills: ELEMENTALIST_CORE_EXTRA_SKILLS,
    balanceProfiles: ELEMENTALIST_CORE_BALANCE_PROFILES
  }),
  state: {
    create: createElementalistCoreState,
    project: createPublicStateProjector(ELEMENTALIST_CORE_PUBLIC_STATE_PROJECTION)
  },
  traitDefinitions: elementalistCoreTraits,
  modifiers: elementalistCoreModifiers,
  hooks: elementalistCoreHooks,
  presentation: bindElementalistCoreUi
});
