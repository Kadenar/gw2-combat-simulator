/**
 * Tempest module wiring.
 *
 * Assembles the specialization's catalog data, per-run state, overload cast rules and
 * live deadlines, shout completion, aura reactions, and skill-bar presentation into
 * the single native module the elementalist family registers.
 */
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createElementalistModuleData } from '#gw2/professions/elementalist/data/module-data.js';
import { tempestHooks } from '#gw2/professions/elementalist/specializations/tempest/hooks.js';
import { tempestModifiers } from '#gw2/professions/elementalist/specializations/tempest/modifiers.js';
import { tempestState } from '#gw2/professions/elementalist/specializations/tempest/state.js';
import { tempestUi } from '#gw2/professions/elementalist/specializations/tempest/presentation.js';
import { TEMPEST_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/tempest/skills/index.js';
import { TEMPEST_BALANCE_PROFILES } from '#gw2/professions/elementalist/specializations/tempest/profiles.js';

/** The Tempest specialization module consumed by the elementalist module registry. */
export const tempestModule = defineNativeModule({
  id: 'Tempest',
  data: createElementalistModuleData('Tempest', {
    skillMechanics: TEMPEST_SKILL_MECHANICS,
    balanceProfiles: TEMPEST_BALANCE_PROFILES
  }),
  state: { create: tempestState.create },
  modifiers: tempestModifiers,
  hooks: tempestHooks,
  presentation: tempestUi
});
