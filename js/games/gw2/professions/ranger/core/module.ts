import { RANGER_CORE_PROFILE_FIELDS } from '#gw2/professions/ranger/core/catalog-fields.js';
import { rangerAttackOfOpportunityModifier } from '#gw2/professions/ranger/core/skills/weapons/greatsword.js';
import { rangerForceOfNatureModifier } from '#gw2/professions/ranger/core/skills/weapons/mace.js';
import { rangerConsumingBiteModifier } from '#gw2/professions/ranger/core/skills/pets/fanged-iboga.js';
import {
  rangerHammerConditionsModifier,
  rangerHammerDisabledModifier
} from '#gw2/professions/ranger/core/skills/weapons/hammer.js';
import { rangerFalconsStoopModifier } from '#gw2/professions/ranger/core/skills/weapons/spear.js';
import { rangerPounceModifier } from '#gw2/professions/ranger/core/skills/weapons/sword.js';

import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { rangerCoreHooks } from '#gw2/professions/ranger/core/hooks.js';

import { bindRangerCoreUi } from '#gw2/professions/ranger/core/presentation.js';
import { rangerPassiveAttributes } from '#gw2/professions/ranger/core/skills/attribute-passives.js';
import {
  RANGER_CORE_BASE_SKILL_MECHANICS,
  RANGER_CORE_EXTRA_SKILLS
} from '#gw2/professions/ranger/core/skills/index.js';
import { sicEmPetModifiers } from '#gw2/professions/ranger/core/skills/slot-skills.js';

import { rangerShortbowConditionDurationModifier } from '#gw2/professions/ranger/core/skills/weapons/shortbow.js';
import { createRangerCoreState, projectRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { rangerCoreTraits } from '#gw2/professions/ranger/core/traits/index.js';
import { createRangerModuleData } from '#gw2/professions/ranger/data/module-data.js';
import { RANGER_CORE_SKILL_FIELDS } from '#gw2/professions/ranger/core/catalog-fields.js';

/** The module registers one live mechanic owner beside its existing data and modifier formulas. */
export const rangerCoreModule = defineNativeModule({
  attributes: rangerPassiveAttributes,
  id: 'Core',
  traitDefinitions: rangerCoreTraits,
  data: createRangerModuleData('Core', {
    profileFields: RANGER_CORE_PROFILE_FIELDS,
    skillFields: RANGER_CORE_SKILL_FIELDS,
    skillMechanics: RANGER_CORE_BASE_SKILL_MECHANICS,
    extraSkills: RANGER_CORE_EXTRA_SKILLS
  }),
  state: { create: createRangerCoreState, project: projectRangerCoreState },
  // Keep player/shared rules before the pet audience and retain the established duration stage.
  modifiers: {
    modifierRules: [
      rangerShortbowConditionDurationModifier,
      rangerAttackOfOpportunityModifier,
      rangerForceOfNatureModifier,
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
