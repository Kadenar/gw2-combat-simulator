import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { balanceProfileNumberFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
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

  const signetMultiplier = hasTrait('Perfect Inscriptions')
    ? balanceProfileNumberFromContext(profileContext, TRAIT.PERFECT_INSCRIPTIONS, 'attributeMultiplier')
    : 1;
  const quickness = guardianBuild.assumptions?.quickness !== false;

  const attributeEffects: readonly Gw2AttributeEffect[] = [
    {
      kind: 'flat',
      source: 'Right-Hand Strength',
      to: 'Precision',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.RIGHT_HAND_STRENGTH, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Right-Hand Strength')
    },
    {
      kind: 'flat',
      source: 'Right-Hand Strength',
      to: 'Power',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.RIGHT_HAND_STRENGTH, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Right-Hand Strength') && oneHandedMainHand
    },
    {
      kind: 'flat',
      source: 'Zealous Blade',
      to: 'Power',
      amount: balanceProfileNumberFromContext(
        profileContext,
        TRAIT.ZEALOUS_BLADE,
        mainHand === 'Greatsword' ? 'weaponAttributeBonus' : 'attributeBonus'
      ),
      feedsConversions: false,
      enabled: hasTrait('Zealous Blade')
    },
    {
      kind: 'flat',
      source: 'Radiant Power',
      to: 'Ferocity',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.RADIANT_POWER, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Radiant Power')
    },
    {
      kind: 'flat',
      source: 'Stalwart Defender',
      to: 'Toughness',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.STALWART_DEFENDER, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Stalwart Defender') && offHand === 'Shield'
    },
    {
      kind: 'flat',
      source: 'Honorable Staff',
      to: 'Concentration',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.HONORABLE_STAFF, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Honorable Staff')
    },
    {
      kind: 'flat',
      source: "Defender's Dogma",
      to: 'Vitality',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.DEFENDERS_DOGMA, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait("Defender's Dogma")
    },
    {
      kind: 'flat',
      source: 'Force of Will',
      to: 'Vitality',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.FORCE_OF_WILL, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait('Force of Will')
    },
    {
      kind: 'flat',
      source: 'Imbued Haste',
      to: 'Condition Damage',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.IMBUED_HASTE, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait('Imbued Haste') && quickness
    },
    {
      kind: 'flat',
      source: 'Imbued Haste',
      to: 'Healing Power',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.IMBUED_HASTE, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait('Imbued Haste') && quickness
    },
    {
      kind: 'flat',
      source: 'Imbued Haste',
      to: 'Vitality',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.IMBUED_HASTE, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait('Imbued Haste') && quickness
    },
    {
      kind: 'flat',
      source: 'Searing Pact',
      to: 'Condition Damage',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.SEARING_PACT, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait('Searing Pact')
    },
    {
      kind: 'flat',
      source: 'Power for Power',
      to: 'Power',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.POWER_FOR_POWER, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait('Power for Power')
    },
    {
      kind: 'flat',
      source: 'Conceited Curate',
      to: 'Vitality',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.CONCEITED_CURATE, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait('Conceited Curate')
    },
    {
      kind: 'flat',
      source: "Light's Gift",
      to: 'Vitality',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.LIGHTS_GIFT, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait("Light's Gift")
    },
    {
      kind: 'conversion',
      source: 'Kindled Zeal',
      from: 'Power',
      to: 'Condition Damage',
      multiplier: balanceProfileNumberFromContext(profileContext, TRAIT.KINDLED_ZEAL, 'attributeConversion'),
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait('Kindled Zeal')
    },
    {
      kind: 'flat',
      source: 'Bane Signet',
      to: 'Power',
      amount:
        balanceProfileNumberFromContext(profileContext, 'guardian.core.bane-signet-passive', 'attributeBonus') *
        signetMultiplier,
      feedsConversions: false,
      enabled: hasSelectedSkill('Bane Signet')
    },
    {
      kind: 'flat',
      source: 'Signet of Wrath',
      to: 'Condition Damage',
      amount:
        balanceProfileNumberFromContext(profileContext, 'guardian.core.signet-of-wrath-passive', 'attributeBonus') *
        signetMultiplier,
      feedsConversions: false,
      enabled: hasSelectedSkill('Signet of Wrath')
    },
    {
      kind: 'conversion',
      source: 'Power of the Virtuous',
      from: 'Vitality',
      to: 'Condition Damage',
      multiplier: balanceProfileNumberFromContext(profileContext, TRAIT.POWER_OF_THE_VIRTUOUS, 'attributeConversion'),
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait('Power of the Virtuous')
    }
  ];

  if (hasTrait('Radiant Fire')) {
    traitDurations['Burning Duration'] =
      100 * balanceProfileNumberFromContext(profileContext, TRAIT.RADIANT_FIRE, 'conditionDurationBonus');
  }

  return finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations
  });
}
