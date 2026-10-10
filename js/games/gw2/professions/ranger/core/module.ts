import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { rangerCoreHooks } from '#gw2/professions/ranger/core/hooks.js';
import { rangerCoreModifiers } from '#gw2/professions/ranger/core/modifiers.js';
import { bindRangerCoreUi } from '#gw2/professions/ranger/core/presentation.js';
import { RANGER_CORE_BALANCE_PROFILES } from '#gw2/professions/ranger/core/profiles.js';
import { rangerPassiveAttributes } from '#gw2/professions/ranger/core/skills/attribute-passives.js';
import {
  RANGER_CORE_BASE_SKILL_MECHANICS,
  RANGER_CORE_EXTRA_SKILLS
} from '#gw2/professions/ranger/core/skills/index.js';
import { sharpeningStoneProfile } from '#gw2/professions/ranger/core/skills/slot-skills.js';
import { poisonousStrikesProfile } from '#gw2/professions/ranger/core/skills/weapons/dagger.js';
import { bloodThirstProfile } from '#gw2/professions/ranger/core/skills/weapons/shortbow.js';
import { createRangerCoreState, RANGER_CORE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/ranger/core/state.js';
import { rangerCoreTraits } from '#gw2/professions/ranger/core/traits/index.js';
import { createRangerModuleData } from '#gw2/professions/ranger/data/module-data.js';

/** The module registers one live mechanic owner beside its existing data and modifier formulas. */
export const rangerCoreModule = defineNativeModule({
  attributes: rangerPassiveAttributes,
  id: 'Core',
  traitDefinitions: rangerCoreTraits,
  data: createRangerModuleData('Core', {
    skillMechanics: RANGER_CORE_BASE_SKILL_MECHANICS,
    balanceProfiles: [
      ...RANGER_CORE_BALANCE_PROFILES,
      sharpeningStoneProfile,
      poisonousStrikesProfile,
      bloodThirstProfile
    ],
    extraSkills: RANGER_CORE_EXTRA_SKILLS
  }),
  state: { create: createRangerCoreState, project: createPublicStateProjector(RANGER_CORE_PUBLIC_STATE_PROJECTION) },
  modifiers: rangerCoreModifiers,
  hooks: rangerCoreHooks,
  presentation: bindRangerCoreUi
});
