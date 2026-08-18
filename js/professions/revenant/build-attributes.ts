import { finalizeBuildAttributes, resolveAttributeEffects } from '../../platform/gw2/attributes.js';
import { bolsteredBondsBonuses } from './bolstered-bonds.js';
import { getActiveTraits } from './data/traits-data.js';
import type {
  Gw2BuildAttributeRuleContext,
  Gw2AttributeEffect,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes
} from '../../platform/gw2/types.js';
import type { RevenantBuild } from './types.js';

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

export function applyRevenantBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  { build, disabledTrait = null }: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const revenantBuild = build as RevenantBuild;
  const { conversionPool } = common.commonContext;
  const activeTraits = getActiveTraits(revenantBuild.specializations || []).filter(
    (trait) => trait.name !== disabledTrait
  );
  const hasTrait = (name: string): boolean => activeTraits.some((trait) => trait.name === name);
  const traitDurations: Gw2NumericAttributes = {};
  const traitCriticalChance = hasTrait('Brutal Momentum') ? 10 : 0;
  if (hasTrait('Pact of Pain')) {
    traitDurations['Condition Duration'] = 15;
  }
  if (hasTrait('Yearning Empowerment')) {
    const duration = hasTrait('Numinous Gift') ? 15 : 10;
    for (const condition of ['Bleeding', 'Burning', 'Confusion', 'Poison', 'Torment']) {
      traitDurations[`${condition} Duration`] = duration;
    }
  }
  const attributeEffects: Gw2AttributeEffect[] = [
    {
      kind: 'flat',
      source: 'Seething Malice',
      to: 'Condition Damage',
      amount: 120,
      feedsConversions: false,
      enabled: hasTrait('Seething Malice')
    },
    {
      kind: 'flat',
      source: 'Life Attunement',
      to: 'Healing Power',
      amount: 120,
      feedsConversions: true,
      enabled: hasTrait('Life Attunement')
    },
    {
      kind: 'flat',
      source: 'Reinforced Potency',
      to: 'Concentration',
      amount: 240,
      feedsConversions: false,
      enabled: hasTrait('Reinforced Potency')
    },
    {
      kind: 'flat',
      source: 'Empire Divided',
      to: 'Power',
      amount:
        Number(revenantBuild.assumptions?.playerHealthFraction ?? revenantBuild.playerHealthFraction ?? 1) > 0.5
          ? 240
          : 0,
      feedsConversions: false,
      enabled: hasTrait('Empire Divided')
    }
  ];
  if (hasTrait('Bolstered Bonds')) {
    for (const [attribute, amount] of Object.entries(bolsteredBondsBonuses(revenantBuild.selectedLegends))) {
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
      multiplier: 0.13,
      rounding: 'round',
      input: 'common',
      enabled: hasTrait('Versed in Stone')
    },
    {
      kind: 'conversion',
      source: 'Life Attunement',
      from: 'Healing Power',
      to: 'Concentration',
      multiplier: 0.07,
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait('Life Attunement')
    },
    {
      kind: 'conversion',
      source: 'Elevated Compassion',
      from: 'Power',
      to: 'Concentration',
      multiplier: 0.13,
      rounding: 'round',
      input: 'common',
      enabled: hasTrait('Elevated Compassion')
    }
  );
  const traitStats = resolveAttributeEffects(conversionPool, attributeEffects);
  return finalizeBuildAttributes(common, {
    activeTraits,
    traitStats,
    traitDurations,
    traitCriticalChance
  });
}
