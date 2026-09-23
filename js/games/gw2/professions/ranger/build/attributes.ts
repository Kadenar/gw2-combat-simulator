import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { soulbeastArchetypeAttributes } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/archetype-attributes.js';
import { getActiveTraits } from '#gw2/professions/ranger/data/traits-data.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';
import type {
  Gw2BuildAttributeRuleContext,
  Gw2AttributeEffect,
  Gw2CommonAttributeResult
} from '#gw2/platform/builds/types.js';
import type { RangerBuild } from '#gw2/professions/ranger/types.js';
import { selectedRangerPet } from '#gw2/professions/ranger/core/state.js';

const PACK_ALPHA_ATTRIBUTES = Object.freeze(['Power', 'Condition Damage', 'Precision', 'Toughness', 'Vitality']);

// Convert runtime attribute keys only where the build calculator requires display names.
const BUILD_ATTRIBUTE_NAMES: Readonly<Record<string, string>> = Object.freeze({
  toughness: 'Toughness',
  vitality: 'Vitality',
  conditionDamage: 'Condition Damage',
  precision: 'Precision',
  concentration: 'Concentration',
  power: 'Power',
  ferocity: 'Ferocity'
});

// Combine weapon-sensitive Ranger traits with Soulbeast-only pet and archetype
// bonuses before finalizing the selected weapon set's build attributes.
export function applyRangerBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  { build, selectedSkills = [], weaponSet = 1, disabledTrait = null, balanceContext }: Gw2BuildAttributeRuleContext
) {
  const rangerBuild = build as RangerBuild;

  const { activeTraits, hasTrait, hasSelectedSkill } = createBuildAttributeContext({
    specializations: rangerBuild.specializations || [],
    selectedSkills,
    disabledTrait,
    getActiveTraits
  });

  // Attribute amounts follow the selected patch while effect ordering and eligibility remain unchanged.
  const profileContext = balanceContext ?? { catalog: rangerCatalog };
  const traitDurations: Record<string, number> = {};
  const weapons = weaponSet === 2 ? rangerBuild.alternateWeapons : rangerBuild.weapons;

  const soulbeast = rangerBuild.specializations?.some((specialization) => specialization.name === 'Soulbeast');

  const stridersStrengthProfile = requireBalanceProfileFromContext(profileContext, TRAIT.STRIDERS_STRENGTH);
  const honedAxesProfile = requireBalanceProfileFromContext(profileContext, TRAIT.HONED_AXES);
  const attributeEffects: Gw2AttributeEffect[] = [
    {
      kind: 'flat',
      source: "Strider's Strength",
      to: 'Power',
      amount: balanceProfileNumber(
        stridersStrengthProfile,
        weapons?.includes('Sword') ? 'weaponAttributeBonus' : 'attributeBonus'
      ),
      feedsConversions: false,
      enabled: hasTrait("Strider's Strength")
    },
    {
      kind: 'flat',
      source: 'Honed Axes',
      to: 'Ferocity',
      amount: balanceProfileNumber(
        honedAxesProfile,
        weapons?.includes('Axe') ? 'weaponAttributeBonus' : 'attributeBonus'
      ),
      feedsConversions: false,
      enabled: hasTrait('Honed Axes')
    }
  ];

  if (soulbeast && hasTrait('Pack Alpha')) {
    for (const attribute of PACK_ALPHA_ATTRIBUTES) {
      const packAlphaProfile = requireBalanceProfileFromContext(profileContext, TRAIT.PACK_ALPHA);
      attributeEffects.push({
        kind: 'flat',
        source: 'Pack Alpha',
        to: attribute,
        amount: balanceProfileNumber(packAlphaProfile, 'attributeBonus'),
        feedsConversions: false
      });
    }
  }

  const favoredWeapon = weapons?.some((weapon) => ['Dagger', 'Mace', 'Torch'].includes(weapon));

  const petsProwessProfile = requireBalanceProfileFromContext(profileContext, TRAIT.PETS_PROWESS);
  const ambidexterityProfile = requireBalanceProfileFromContext(profileContext, TRAIT.AMBIDEXTERITY);
  const arachnophobiaProfile = requireBalanceProfileFromContext(profileContext, TRAIT.ARACHNOPHOBIA);
  const lingeringMagicProfile = requireBalanceProfileFromContext(profileContext, TRAIT.LINGERING_MAGIC);
  const naturalFortitudeProfile = requireBalanceProfileFromContext(profileContext, TRAIT.NATURAL_FORTITUDE);
  const wellspringProfile = requireBalanceProfileFromContext(profileContext, TRAIT.WELLSPRING);
  const viciousQuarryProfile = requireBalanceProfileFromContext(profileContext, TRAIT.VICIOUS_QUARRY);
  const signetOfTheWildProfile = requireBalanceProfileFromContext(profileContext, 'ranger.core.signet-of-the-wild');
  attributeEffects.push(
    {
      kind: 'flat',
      source: "Pet's Prowess",
      to: 'Ferocity',
      amount: balanceProfileNumber(petsProwessProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: soulbeast && hasTrait("Pet's Prowess")
    },
    {
      kind: 'flat',
      source: 'Ambidexterity',
      to: 'Condition Damage',
      amount: balanceProfileNumber(ambidexterityProfile, favoredWeapon ? 'weaponAttributeBonus' : 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Ambidexterity')
    },
    {
      kind: 'flat',
      source: 'Arachnophobia',
      to: 'Expertise',
      amount: balanceProfileNumber(arachnophobiaProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Arachnophobia')
    },
    {
      kind: 'flat',
      source: 'Lingering Magic',
      to: 'Concentration',
      amount: balanceProfileNumber(lingeringMagicProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Lingering Magic')
    },
    {
      kind: 'flat',
      source: 'Natural Fortitude',
      to: 'Vitality',
      amount: balanceProfileNumber(naturalFortitudeProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Natural Fortitude')
    },
    {
      kind: 'conversion',
      source: 'Wellspring',
      from: 'Power',
      to: 'Healing Power',
      multiplier: balanceProfileNumber(wellspringProfile, 'attributeConversion'),
      rounding: 'none',
      input: 'common',
      enabled: hasTrait('Wellspring')
    },
    {
      kind: 'flat',
      source: 'Vicious Quarry',
      to: 'Ferocity',
      amount: balanceProfileNumber(viciousQuarryProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Vicious Quarry') && rangerBuild.assumptions?.fury !== false
    },
    {
      kind: 'flat',
      source: 'Signet of the Wild',
      to: 'Ferocity',
      amount: balanceProfileNumber(signetOfTheWildProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasSelectedSkill('Signet of the Wild')
    }
  );

  if (soulbeast) {
    const archetype = selectedRangerPet(rangerBuild)?.archetype || '';

    for (const [attribute, amount] of Object.entries(soulbeastArchetypeAttributes(profileContext, archetype))) {
      attributeEffects.push({
        kind: 'flat',
        source: `Soulbeast ${archetype}`,
        to: BUILD_ATTRIBUTE_NAMES[attribute],
        amount: Number(amount),
        feedsConversions: false
      });
    }
  }

  return finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations
  });
}
