import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { getActiveTraits } from '#gw2/professions/guardian/data/traits-data.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';
import type {
  Gw2CommonAttributeResult,
  Gw2BuildAttributeRuleContext,
  Gw2AttributeEffect,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes
} from '#gw2/platform/builds/types.js';
import type { GuardianBuild } from '#gw2/professions/guardian/types.js';

// Apply Guardian trait, weapon, and selected-skill bonuses at build time while
// retaining provenance needed to avoid reapplying panel-visible modifiers.
export function applyGuardianBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  { build, selectedSkills = [], weaponSet = 1, disabledTrait = null, balanceContext }: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const guardianBuild = build as GuardianBuild;

  const { activeTraits, hasTrait, hasSelectedSkill } = createBuildAttributeContext({
    specializations: guardianBuild.specializations || [],
    selectedSkills,
    disabledTrait,
    getActiveTraits
  });

  // Build previews and simulation tooltips use the same selected patch values.
  const profileContext = balanceContext ?? { catalog: guardianCatalog };

  const traitDurations: Gw2NumericAttributes = {};
  const weapons = weaponSet === 2 ? guardianBuild.alternateWeapons : guardianBuild.weapons;
  const mainHand = weapons?.[0] || '';
  const offHand = weapons?.[1] || '';

  const oneHandedMainHand =
    mainHand !== '' && !['Greatsword', 'Hammer', 'Longbow', 'Spear', 'Staff'].includes(mainHand);

  const signetMultiplier = hasTrait(TRAIT.PERFECT_INSCRIPTIONS)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(profileContext, TRAIT.PERFECT_INSCRIPTIONS),
        'attributeMultiplier'
      )
    : 1;
  const quickness = guardianBuild.assumptions?.quickness !== false;

  const rightHandStrengthProfile = requireBalanceProfileFromContext(profileContext, TRAIT.RIGHT_HAND_STRENGTH);
  const zealousBladeProfile = requireBalanceProfileFromContext(profileContext, TRAIT.ZEALOUS_BLADE);
  const radiantPowerProfile = requireBalanceProfileFromContext(profileContext, TRAIT.RADIANT_POWER);
  const stalwartDefenderProfile = requireBalanceProfileFromContext(profileContext, TRAIT.STALWART_DEFENDER);
  const honorableStaffProfile = requireBalanceProfileFromContext(profileContext, TRAIT.HONORABLE_STAFF);
  const defendersDogmaProfile = requireBalanceProfileFromContext(profileContext, TRAIT.DEFENDERS_DOGMA);
  const forceOfWillProfile = requireBalanceProfileFromContext(profileContext, TRAIT.FORCE_OF_WILL);
  const imbuedHasteProfile = requireBalanceProfileFromContext(profileContext, TRAIT.IMBUED_HASTE);
  const searingPactProfile = requireBalanceProfileFromContext(profileContext, TRAIT.SEARING_PACT);
  const powerForPowerProfile = requireBalanceProfileFromContext(profileContext, TRAIT.POWER_FOR_POWER);
  const conceitedCurateProfile = requireBalanceProfileFromContext(profileContext, TRAIT.CONCEITED_CURATE);
  const lightsGiftProfile = requireBalanceProfileFromContext(profileContext, TRAIT.LIGHTS_GIFT);
  const kindledZealProfile = requireBalanceProfileFromContext(profileContext, TRAIT.KINDLED_ZEAL);
  const baneSignetPassiveProfile = requireBalanceProfileFromContext(
    profileContext,
    'guardian.core.bane-signet-passive'
  );
  const signetOfWrathPassiveProfile = requireBalanceProfileFromContext(
    profileContext,
    'guardian.core.signet-of-wrath-passive'
  );
  const powerOfTheVirtuousProfile = requireBalanceProfileFromContext(profileContext, TRAIT.POWER_OF_THE_VIRTUOUS);
  const attributeEffects: readonly Gw2AttributeEffect[] = [
    {
      kind: 'flat',
      source: 'Right-Hand Strength',
      to: 'Precision',
      amount: balanceProfileNumber(rightHandStrengthProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.RIGHT_HAND_STRENGTH)
    },
    {
      kind: 'flat',
      source: 'Right-Hand Strength',
      to: 'Power',
      amount: balanceProfileNumber(rightHandStrengthProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.RIGHT_HAND_STRENGTH) && oneHandedMainHand
    },
    {
      kind: 'flat',
      source: 'Zealous Blade',
      to: 'Power',
      amount: balanceProfileNumber(
        zealousBladeProfile,
        mainHand === 'Greatsword' ? 'weaponAttributeBonus' : 'attributeBonus'
      ),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.ZEALOUS_BLADE)
    },
    {
      kind: 'flat',
      source: 'Radiant Power',
      to: 'Ferocity',
      amount: balanceProfileNumber(radiantPowerProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.RADIANT_POWER)
    },
    {
      kind: 'flat',
      source: 'Stalwart Defender',
      to: 'Toughness',
      amount: balanceProfileNumber(stalwartDefenderProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.STALWART_DEFENDER) && offHand === 'Shield'
    },
    {
      kind: 'flat',
      source: 'Honorable Staff',
      to: 'Concentration',
      amount: balanceProfileNumber(honorableStaffProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.HONORABLE_STAFF)
    },
    {
      kind: 'flat',
      source: "Defender's Dogma",
      to: 'Vitality',
      amount: balanceProfileNumber(defendersDogmaProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.DEFENDERS_DOGMA)
    },
    {
      kind: 'flat',
      source: 'Force of Will',
      to: 'Vitality',
      amount: balanceProfileNumber(forceOfWillProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.FORCE_OF_WILL)
    },
    {
      kind: 'flat',
      source: 'Imbued Haste',
      to: 'Condition Damage',
      amount: balanceProfileNumber(imbuedHasteProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.IMBUED_HASTE) && quickness
    },
    {
      kind: 'flat',
      source: 'Imbued Haste',
      to: 'Healing Power',
      amount: balanceProfileNumber(imbuedHasteProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.IMBUED_HASTE) && quickness
    },
    {
      kind: 'flat',
      source: 'Imbued Haste',
      to: 'Vitality',
      amount: balanceProfileNumber(imbuedHasteProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.IMBUED_HASTE) && quickness
    },
    {
      kind: 'flat',
      source: 'Searing Pact',
      to: 'Condition Damage',
      amount: balanceProfileNumber(searingPactProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.SEARING_PACT)
    },
    {
      kind: 'flat',
      source: 'Power for Power',
      to: 'Power',
      amount: balanceProfileNumber(powerForPowerProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.POWER_FOR_POWER)
    },
    {
      kind: 'flat',
      source: 'Conceited Curate',
      to: 'Vitality',
      amount: balanceProfileNumber(conceitedCurateProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.CONCEITED_CURATE)
    },
    {
      kind: 'flat',
      source: "Light's Gift",
      to: 'Vitality',
      amount: balanceProfileNumber(lightsGiftProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.LIGHTS_GIFT)
    },
    {
      kind: 'conversion',
      source: 'Kindled Zeal',
      from: 'Power',
      to: 'Condition Damage',
      multiplier: balanceProfileNumber(kindledZealProfile, 'attributeConversion'),
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait(TRAIT.KINDLED_ZEAL)
    },
    {
      kind: 'flat',
      source: 'Bane Signet',
      to: 'Power',
      amount: balanceProfileNumber(baneSignetPassiveProfile, 'attributeBonus') * signetMultiplier,
      feedsConversions: false,
      enabled: hasSelectedSkill(ID.BANE_SIGNET)
    },
    {
      kind: 'flat',
      source: 'Signet of Wrath',
      to: 'Condition Damage',
      amount: balanceProfileNumber(signetOfWrathPassiveProfile, 'attributeBonus') * signetMultiplier,
      feedsConversions: false,
      enabled: hasSelectedSkill(ID.SIGNET_OF_WRATH)
    },
    {
      kind: 'conversion',
      source: 'Power of the Virtuous',
      from: 'Vitality',
      to: 'Condition Damage',
      multiplier: balanceProfileNumber(powerOfTheVirtuousProfile, 'attributeConversion'),
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait(TRAIT.POWER_OF_THE_VIRTUOUS)
    }
  ];

  if (hasTrait(TRAIT.RADIANT_FIRE)) {
    const radiantFireProfile = requireBalanceProfileFromContext(profileContext, TRAIT.RADIANT_FIRE);
    traitDurations['Burning Duration'] = 100 * balanceProfileNumber(radiantFireProfile, 'conditionDurationBonus');
  }

  return finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations
  });
}
