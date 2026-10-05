import { mechanistTraits } from '#gw2/professions/engineer/specializations/mechanist/traits/index.js';
import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createEngineerModuleData } from '#gw2/professions/engineer/data/module-data.js';
import { mechanistHooks } from '#gw2/professions/engineer/specializations/mechanist/hooks.js';
import { mechanistModifiers } from '#gw2/professions/engineer/specializations/mechanist/modifiers.js';
import { mechanistUi } from '#gw2/professions/engineer/specializations/mechanist/presentation.js';
import { MECHANIST_BALANCE_PROFILES } from '#gw2/professions/engineer/specializations/mechanist/profiles.js';
import { MECHANIST_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/mechanist/skills/index.js';
import {
  MECHANIST_PUBLIC_STATE_PROJECTION,
  mechanistState
} from '#gw2/professions/engineer/specializations/mechanist/state.js';

// Compose the mech's independent live lane with accepted-hit reactions for
// hit-triggered traits; the engineer's own cast lane remains owned by Core.
export const mechanistModule = defineNativeModule({
  id: 'Mechanist',
  traitDefinitions: mechanistTraits,
  data: createEngineerModuleData('Mechanist', {
    skillMechanics: MECHANIST_SKILL_MECHANICS,
    balanceProfiles: MECHANIST_BALANCE_PROFILES
  }),
  state: { create: mechanistState.create, project: createPublicStateProjector(MECHANIST_PUBLIC_STATE_PROJECTION) },
  modifiers: mechanistModifiers,
  hooks: mechanistHooks,
  presentation: mechanistUi
});
