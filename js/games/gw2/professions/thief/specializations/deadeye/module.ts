import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { selectedThiefTraits } from '#gw2/professions/thief/core/state.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { createThiefModuleData } from '#gw2/professions/thief/data/module-data.js';
import { deadeyeHooks } from '#gw2/professions/thief/specializations/deadeye/hooks.js';
import { deadeyeModifiers } from '#gw2/professions/thief/specializations/deadeye/modifiers.js';
import { deadeyeUi } from '#gw2/professions/thief/specializations/deadeye/presentation.js';
import {
  DEADEYE_BALANCE_PROFILES,
  DEADEYE_RESOURCE_PROFILE
} from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import { DEADEYE_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/deadeye/skills/index.js';
import { DEADEYE_PUBLIC_STATE_PROJECTION, deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { deadeyeTraits, maleficentSeven } from '#gw2/professions/thief/specializations/deadeye/traits/index.js';

export const deadeyeModule = defineNativeModule({
  traitDefinitions: deadeyeTraits,
  id: 'Deadeye',
  data: createThiefModuleData('Deadeye', {
    skillMechanics: DEADEYE_SKILL_MECHANICS,
    balanceProfiles: DEADEYE_BALANCE_PROFILES
  }),
  state: {
    // Keep canonical trait defaults at composition so state and behavior never import definitions.
    create: (config) =>
      deadeyeState.create(
        balanceProfileNumber(
          hasTrait(selectedThiefTraits(config), TRAIT.MALEFICENT_SEVEN)
            ? (maleficentSeven.balance as BalanceProfile)
            : DEADEYE_RESOURCE_PROFILE,
          'maximumStacks'
        )
      ),
    project: createPublicStateProjector(DEADEYE_PUBLIC_STATE_PROJECTION)
  },
  modifiers: deadeyeModifiers,
  hooks: deadeyeHooks,
  presentation: deadeyeUi
});
