import type {
  Gw2AttributeEffect,
  Gw2BuildAttributeRuleContext,
  Gw2CommonAttributeResult
} from '#gw2/platform/builds/types.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { signetOfTheWildBonus } from '#gw2/professions/ranger/core/skills/slot-skills.js';
import { selectedRangerPet } from '#gw2/professions/ranger/core/state.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { getActiveTraits } from '#gw2/professions/ranger/data/traits-data.js';
import { soulbeastArchetypeAttributes } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/archetype-attributes.js';
import type { RangerBuild } from '#gw2/professions/ranger/types.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';

const BUILD_ATTRIBUTE_NAMES: Readonly<Record<string, string>> = {
  toughness: 'Toughness',
  vitality: 'Vitality',
  conditionDamage: 'Condition Damage',
  precision: 'Precision',
  concentration: 'Concentration',
  power: 'Power',
  ferocity: 'Ferocity'
};
/** Skill passives and merged archetypes remain mechanical; registered traits supply their own build contributions. */
export function applyRangerBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext
) {
  const rangerBuild = context.build as RangerBuild;
  const { activeTraits, hasSelectedSkillId, profileContext } = createBuildAttributeContext(
    context,
    rangerCatalog,
    getActiveTraits
  );
  const soulbeast = rangerBuild.specializations?.some((s) => s.name === 'Soulbeast');
  const attributeEffects: Gw2AttributeEffect[] = [
    {
      kind: 'flat',
      to: 'Ferocity',
      amount: signetOfTheWildBonus(profileContext, hasSelectedSkillId(ID.SIGNET_OF_THE_WILD)),
      feedsConversions: false
    }
  ];
  if (soulbeast) {
    const archetype = selectedRangerPet(rangerBuild)?.archetype || '';

    for (const [attribute, amount] of Object.entries(soulbeastArchetypeAttributes(profileContext, archetype))) {
      attributeEffects.push({
        kind: 'flat',
        to: BUILD_ATTRIBUTE_NAMES[attribute],
        amount: amount,
        feedsConversions: false
      });
    }
  }

  return finalizeProfessionBuildAttributes(common, { activeTraits, attributeEffects }, context);
}
