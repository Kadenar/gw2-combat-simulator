import { ATTRIBUTE_NAMES } from '#gw2/platform/attributes/inputs.js';
import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { activeRangerPet, beastmodeActive } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { TRAIT_LINES } from '#gw2/professions/ranger/data/trait-lines.js';
import { RANGER_SOULBEAST_PROFILE_FIELDS } from '#gw2/professions/ranger/specializations/soulbeast/catalog-fields.js';
import { soulbeastHooks } from '#gw2/professions/ranger/specializations/soulbeast/hooks.js';
import { soulbeastArchetypeAttributes } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/archetype-attributes.js';
import { bindSoulbeastUi } from '#gw2/professions/ranger/specializations/soulbeast/presentation.js';
import { SOULBEAST_BASE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/index.js';
import {
  projectSoulbeastPlanningState,
  soulbeastState
} from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import { soulbeastTraits } from '#gw2/professions/ranger/specializations/soulbeast/traits/index.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

/** The module registers one live mechanic owner beside its existing data and modifier formulas. */
export const soulbeastModule = defineNativeModule({
  id: 'Soulbeast',
  data: createNativeModuleData<RangerSkill>({
    id: 'Soulbeast',
    traitLines: TRAIT_LINES,
    profileFields: RANGER_SOULBEAST_PROFILE_FIELDS,
    skills: materializeSkillDefinitions(SOULBEAST_BASE_SKILL_MECHANICS)
  }),
  state: { create: soulbeastState.create, project: projectSoulbeastPlanningState },
  traitDefinitions: soulbeastTraits,
  /** The active pet supplies merge attributes to both preview and combat without conversion eligibility. */
  attributes: (context) => {
    if (!(context.runtime ? beastmodeActive(context) : context.loadout.merged)) return [];

    return [
      {
        attributeEffects: Object.entries(soulbeastArchetypeAttributes(activeRangerPet(context).archetype)).map(
          ([key, amount]) => ({
            kind: 'flat',
            to: ATTRIBUTE_NAMES[key as keyof typeof ATTRIBUTE_NAMES],
            amount,
            feedsConversions: 'none'
          })
        )
      }
    ];
  },
  hooks: soulbeastHooks,
  presentation: bindSoulbeastUi
});
