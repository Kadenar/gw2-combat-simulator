import { rangerAttackOfOpportunityModifier } from '#gw2/professions/ranger/core/mechanics/greatsword.js';
import { rangerConsumingBiteModifier } from '#gw2/professions/ranger/core/skills/pets/fanged-iboga.js';
import {
  rangerHammerConditionsModifier,
  rangerHammerDisabledModifier
} from '#gw2/professions/ranger/core/skills/weapons/hammer.js';
import { rangerFalconsStoopModifier } from '#gw2/professions/ranger/core/skills/weapons/spear.js';
import { rangerPounceModifier } from '#gw2/professions/ranger/core/skills/weapons/sword.js';

import { modifyRangerConditionBaseDuration } from '#gw2/professions/ranger/core/traits/skirmishing/attributes.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { rangerCoreHooks } from '#gw2/professions/ranger/core/hooks.js';

import { bindRangerCoreUi } from '#gw2/professions/ranger/core/presentation.js';
import { RANGER_CORE_BALANCE_PROFILES } from '#gw2/professions/ranger/core/profiles.js';
import { rangerPassiveAttributes } from '#gw2/professions/ranger/core/skills/attribute-passives.js';
import {
  RANGER_CORE_BASE_SKILL_MECHANICS,
  RANGER_CORE_EXTRA_SKILLS
} from '#gw2/professions/ranger/core/skills/index.js';
import { sharpeningStoneProfile, sicEmPetModifiers } from '#gw2/professions/ranger/core/skills/slot-skills.js';
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
  // Keep player/shared rules before the pet audience and retain the established duration stage.
  modifiers: {
    modifyConditionBaseDuration: modifyRangerConditionBaseDuration,
    modifierRules: [
      rangerAttackOfOpportunityModifier,
      ...[
        rangerHammerDisabledModifier,
        rangerPounceModifier,
        rangerFalconsStoopModifier,
        rangerHammerConditionsModifier,
        rangerConsumingBiteModifier
      ].map((rule, index) => ({ ...rule, order: 15 + index })),
      ...sicEmPetModifiers.map((rule, index) => ({ ...rule, order: 30 + index }))
    ]
  },
  hooks: rangerCoreHooks,
  presentation: bindRangerCoreUi
});
