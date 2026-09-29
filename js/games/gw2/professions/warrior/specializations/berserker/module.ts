import { slicingMaelstromModifiers } from '#gw2/professions/warrior/specializations/berserker/skills/index.js';
import { createPublicStateProjector } from '#gw2/platform/engine/profession/state.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createWarriorModuleData } from '#gw2/professions/warrior/data/module-data.js';
import { berserkerHooks } from '#gw2/professions/warrior/specializations/berserker/hooks.js';
import { modifyAttributes } from '#gw2/professions/warrior/specializations/berserker/traits/behavior.js';
import { berserkerUi } from '#gw2/professions/warrior/specializations/berserker/presentation.js';
import { BERSERKER_BALANCE_PROFILES } from '#gw2/professions/warrior/specializations/berserker/profiles.js';
import { BERSERKER_SKILL_MECHANICS } from '#gw2/professions/warrior/specializations/berserker/skills/index.js';
import {
  BERSERKER_PUBLIC_STATE_PROJECTION,
  berserkerState
} from '#gw2/professions/warrior/specializations/berserker/state.js';
import { warriorBerserkerTraits } from '#gw2/professions/warrior/specializations/berserker/traits/index.js';

export const berserkerModule = defineNativeModule({
  traitDefinitions: warriorBerserkerTraits,
  id: 'Berserker',
  data: createWarriorModuleData('Berserker', {
    skillMechanics: BERSERKER_SKILL_MECHANICS,
    balanceProfiles: BERSERKER_BALANCE_PROFILES
  }),
  state: { create: berserkerState.create, project: createPublicStateProjector(BERSERKER_PUBLIC_STATE_PROJECTION) },
  // Preserve live trait attributes alongside skill-owned Slicing Maelstrom rules.
  modifiers: { modifyAttributes, modifierRules: slicingMaelstromModifiers },
  hooks: berserkerHooks,
  presentation: berserkerUi
});
