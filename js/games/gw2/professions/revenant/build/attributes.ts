import { HERALD_ELEVATED_COMPASSION_PROFILE_ID } from '#gw2/professions/revenant/specializations/herald/profiles.js';
import { balanceProfileNumberFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { bolsteredBondsBonuses } from '#gw2/professions/revenant/specializations/conduit/traits/bolstered-bonds.js';
import { getActiveTraits } from '#gw2/professions/revenant/data/traits-data.js';
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
import type { RevenantBuild } from '#gw2/professions/revenant/types.js';

const BUILD_ATTRIBUTE_NAMES = Object.freeze({
  power: 'Power',
  precision: 'Precision',
  toughness: 'Toughness',
  vitality: 'Vitality',
  ferocity: 'Ferocity',
  conditionDamage: 'Condition Damage',
  expertise: 'Expertise',
  concentration: 'Concentration',
  healingPower: 'Healing Power'
});

// Assemble Revenant trait durations, legend-pair bonuses, flat attributes, and
// ordered conversions into the shared build-time attribute result.
export function applyRevenantBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  { build, disabledTrait = null, balanceContext }: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const revenantBuild = build as RevenantBuild;

  const { activeTraits, hasTrait } = createBuildAttributeContext({
    specializations: revenantBuild.specializations || [],
    disabledTrait,
    getActiveTraits
  });

  // Attribute amounts follow the selected patch while effect ordering and eligibility remain unchanged.
  const profileContext = balanceContext ?? { catalog: revenantCatalog };
  const traitDurations: Gw2NumericAttributes = {};
  const traitCriticalChance = hasTrait('Brutal Momentum')
    ? 100 * balanceProfileNumberFromContext(profileContext, 'revenant.renegade.brutal-momentum', 'criticalChance')
    : 0;

  if (hasTrait('Pact of Pain')) {
    traitDurations['Condition Duration'] =
      100 * balanceProfileNumberFromContext(profileContext, TRAIT.PACT_OF_PAIN, 'conditionDurationBonus');
  }

  if (hasTrait('Yearning Empowerment')) {
    const duration =
      100 * balanceProfileNumberFromContext(profileContext, TRAIT.YEARNING_EMPOWERMENT, 'conditionDurationBonus') +
      (hasTrait('Numinous Gift')
        ? 100 *
          balanceProfileNumberFromContext(profileContext, 'revenant.conduit.numinous-gift', 'conditionDurationBonus')
        : 0);

    for (const condition of ['Bleeding', 'Burning', 'Confusion', 'Poison', 'Torment']) {
      traitDurations[`${condition} Duration`] = duration;
    }
  }

  const attributeEffects: Gw2AttributeEffect[] = [
    {
      kind: 'flat',
      source: 'Seething Malice',
      to: 'Condition Damage',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.SEETHING_MALICE, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Seething Malice')
    },
    {
      kind: 'flat',
      source: 'Life Attunement',
      to: 'Healing Power',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.LIFE_ATTUNEMENT, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait('Life Attunement')
    },
    {
      kind: 'flat',
      source: 'Reinforced Potency',
      to: 'Concentration',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.REINFORCED_POTENCY, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Reinforced Potency')
    },
    {
      kind: 'flat',
      source: 'Empire Divided',
      to: 'Power',
      // The fixed full-health assumption always enables Empire Divided's Power bonus.
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.EMPIRE_DIVIDED, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Empire Divided')
    }
  ];

  if (hasTrait('Bolstered Bonds')) {
    for (const [attribute, amount] of Object.entries(
      bolsteredBondsBonuses(profileContext, revenantBuild.selectedLegends)
    )) {
      attributeEffects.push({
        kind: 'flat',
        source: 'Bolstered Bonds',
        to: BUILD_ATTRIBUTE_NAMES[attribute as keyof typeof BUILD_ATTRIBUTE_NAMES],
        amount,
        feedsConversions: false
      });
    }
  }

  attributeEffects.push(
    {
      kind: 'conversion',
      source: 'Versed in Stone',
      from: 'Toughness',
      to: 'Power',
      multiplier: balanceProfileNumberFromContext(profileContext, TRAIT.VERSED_IN_STONE, 'attributeConversion'),
      rounding: 'round',
      input: 'common',
      enabled: hasTrait('Versed in Stone')
    },
    {
      kind: 'conversion',
      source: 'Life Attunement',
      from: 'Healing Power',
      to: 'Concentration',
      multiplier: balanceProfileNumberFromContext(profileContext, TRAIT.LIFE_ATTUNEMENT, 'attributeConversion'),
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait('Life Attunement')
    },
    {
      kind: 'conversion',
      source: 'Elevated Compassion',
      from: 'Power',
      to: 'Concentration',
      multiplier: balanceProfileNumberFromContext(
        profileContext,
        HERALD_ELEVATED_COMPASSION_PROFILE_ID,
        'attributeConversion'
      ),
      rounding: 'round',
      input: 'common',
      enabled: hasTrait('Elevated Compassion')
    }
  );

  return finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations,
    traitCriticalChance
  });
}
