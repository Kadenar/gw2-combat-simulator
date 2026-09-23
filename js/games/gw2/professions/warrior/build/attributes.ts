import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { WARRIOR_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/warrior/core/profiles.js';
import { warriorCatalog } from '#gw2/professions/warrior/catalog.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

import { getActiveTraits } from '#gw2/professions/warrior/data/traits-data.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';
import type {
  Gw2BuildAttributeRuleContext,
  Gw2AttributeEffect,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes
} from '#gw2/platform/builds/types.js';
import type { ProfessionTraitSelection } from '#gw2/professions/shared/trait-data.js';

// Apply selected signets, weapon-sensitive traits, duration bonuses, and ordered
// Warrior conversions to the shared build-time attribute result.
export function applyWarriorBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  { build, weaponSet, selectedSkills = [], disabledTrait = null, balanceContext }: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const { activeTraits, hasTrait, hasSelectedSkill } = createBuildAttributeContext({
    specializations: (build.specializations || []) as ProfessionTraitSelection[],
    selectedSkills,
    disabledTrait,
    getActiveTraits
  });

  // Weapon bonuses follow the selected set; base bonuses retain their conversion eligibility.
  const weapons = (weaponSet === 2 ? build.alternateWeapons : build.weapons) || [];

  // Build previews and simulation tooltips use the same selected patch values.
  const profileContext = balanceContext ?? { catalog: warriorCatalog };

  const traitDurations: Gw2NumericAttributes = {};

  const greatFortitudeProfile = requireBalanceProfileFromContext(profileContext, TRAIT.GREAT_FORTITUDE);
  const forcefulGreatswordProfile = requireBalanceProfileFromContext(profileContext, TRAIT.FORCEFUL_GREATSWORD);
  const signetPassivesProfile = requireBalanceProfileFromContext(profileContext, CORE.signetPassives);
  const roaringReveilleProfile = requireBalanceProfileFromContext(profileContext, TRAIT.ROARING_REVEILLE);
  const deepStrikesProfile = requireBalanceProfileFromContext(profileContext, TRAIT.DEEP_STRIKES);
  const woundingPrecisionProfile = requireBalanceProfileFromContext(profileContext, TRAIT.WOUNDING_PRECISION);
  const blademasterProfile = requireBalanceProfileFromContext(profileContext, TRAIT.BLADEMASTER);
  const axeMasteryProfile = requireBalanceProfileFromContext(profileContext, TRAIT.AXE_MASTERY);
  const inspiringImplementsProfile = requireBalanceProfileFromContext(profileContext, TRAIT.INSPIRING_IMPLEMENTS);
  const attributeEffects: readonly Gw2AttributeEffect[] = [
    {
      kind: 'flat',
      source: 'Signet of Might',
      to: 'Power',
      amount: balanceProfileNumber(signetPassivesProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasSelectedSkill('Signet of Might')
    },
    {
      kind: 'flat',
      source: 'Signet of Fury',
      to: 'Precision',
      amount: balanceProfileNumber(signetPassivesProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasSelectedSkill('Signet of Fury')
    },
    {
      kind: 'flat',
      source: 'Forceful Greatsword',
      to: 'Power',
      amount: balanceProfileNumber(forcefulGreatswordProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait('Forceful Greatsword')
    },
    {
      kind: 'flat',
      source: 'Forceful Greatsword',
      to: 'Power',
      amount: balanceProfileNumber(forcefulGreatswordProfile, 'weaponAttributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Forceful Greatsword') && weapons.includes('Greatsword')
    },
    {
      kind: 'conversion',
      source: 'Great Fortitude',
      from: 'Power',
      to: 'Vitality',
      multiplier: balanceProfileNumber(greatFortitudeProfile, 'attributeConversion'),
      rounding: 'none',
      input: 'eligible',
      enabled: hasTrait('Great Fortitude')
    },
    {
      kind: 'conversion',
      source: 'Great Fortitude',
      from: 'Power',
      to: 'Ferocity',
      multiplier: balanceProfileNumber(greatFortitudeProfile, 'attributeConversion'),
      rounding: 'none',
      input: 'eligible',
      enabled: hasTrait('Great Fortitude')
    },
    {
      kind: 'flat',
      source: 'Roaring Reveille',
      to: 'Concentration',
      amount: balanceProfileNumber(roaringReveilleProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Roaring Reveille')
    },
    {
      kind: 'flat',
      source: 'Deep Strikes',
      to: 'Condition Damage',
      amount: balanceProfileNumber(deepStrikesProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Deep Strikes') && Boolean((build.assumptions as Record<string, unknown> | undefined)?.fury)
    },
    {
      kind: 'conversion',
      source: 'Wounding Precision',
      from: 'Precision',
      to: 'Expertise',
      multiplier: balanceProfileNumber(woundingPrecisionProfile, 'attributeConversion'),
      rounding: 'none',
      input: 'eligible',
      enabled: hasTrait('Wounding Precision')
    },
    {
      kind: 'flat',
      source: 'Blademaster',
      to: 'Expertise',
      amount: balanceProfileNumber(blademasterProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Blademaster')
    },
    {
      kind: 'flat',
      source: 'Axe Mastery',
      to: 'Ferocity',
      amount: balanceProfileNumber(
        axeMasteryProfile,
        weapons.includes('Axe') ? 'weaponAttributeBonus' : 'attributeBonus'
      ),
      feedsConversions: false,
      enabled: hasTrait('Axe Mastery')
    },
    {
      kind: 'flat',
      source: 'Inspiring Implements',
      to: 'Concentration',
      amount: balanceProfileNumber(inspiringImplementsProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Inspiring Implements')
    }
  ];

  if (hasTrait('Bloodlust')) {
    const bloodlustProfile = requireBalanceProfileFromContext(profileContext, TRAIT.BLOODLUST);
    traitDurations['Bleeding Duration'] = 100 * balanceProfileNumber(bloodlustProfile, 'conditionDurationBonus');
  }

  if (hasTrait('King of Fires')) {
    const kingOfFiresProfile = requireBalanceProfileFromContext(profileContext, TRAIT.KING_OF_FIRES);
    traitDurations['Burning Duration'] = balanceProfileNumber(kingOfFiresProfile, 'durationMultiplier') * 100;
  }

  return finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations
  });
}
