import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createThiefModuleData } from '#gw2/professions/thief/data/module-data.js';
import { deadeyeHooks } from '#gw2/professions/thief/specializations/deadeye/hooks.js';
import { deadeyeModifiers } from '#gw2/professions/thief/specializations/deadeye/modifiers.js';
import { deadeyeUi } from '#gw2/professions/thief/specializations/deadeye/presentation.js';
import { DEADEYE_BALANCE_PROFILES } from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import { DEADEYE_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/deadeye/skills/index.js';
import { DEADEYE_PUBLIC_STATE_PROJECTION, deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { deadeyeTraits } from '#gw2/professions/thief/specializations/deadeye/traits/index.js';

export const deadeyeModule = defineNativeModule({
  traitDefinitions: deadeyeTraits,
  id: 'Deadeye',
  data: createThiefModuleData('Deadeye', {
    skillMechanics: DEADEYE_SKILL_MECHANICS,
    balanceProfiles: DEADEYE_BALANCE_PROFILES
  }),
  state: {
    create: () => deadeyeState.create(),
    project: createPublicStateProjector(DEADEYE_PUBLIC_STATE_PROJECTION)
  },
  modifiers: deadeyeModifiers,
  hooks: deadeyeHooks,
  presentation: deadeyeUi
});
