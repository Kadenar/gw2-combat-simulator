import { finalizeBuildAttributes, resolveAttributeEffects } from '../../platform/gw2/attributes.js';
import { getActiveTraits } from './data/traits-data.js';
import type {
  Gw2BuildAttributeRuleContext,
  Gw2AttributeEffect,
  Gw2CommonAttributeResult
} from '../../platform/gw2/types.js';
import type { RangerBuild } from './types.js';
import { selectedRangerPet } from './core/state.js';

const PACK_ALPHA_ATTRIBUTES = Object.freeze(['Power', 'Condition Damage', 'Precision', 'Toughness', 'Vitality']);

const SOULBEAST_ARCHETYPE_ATTRIBUTES: Readonly<Record<string, Readonly<Record<string, number>>>> = Object.freeze({
  Stout: Object.freeze({ Toughness: 200, Vitality: 100 }),
  Deadly: Object.freeze({ 'Condition Damage': 150, Precision: 100 }),
  Versatile: Object.freeze({ Vitality: 200, Concentration: 225 }),
  Ferocious: Object.freeze({ Power: 150, Ferocity: 100 }),
  Supportive: Object.freeze({ Vitality: 100 })
});

export function applyRangerBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  { build, selectedSkills = [], weaponSet = 1, disabledTrait = null }: Gw2BuildAttributeRuleContext
) {
  const rangerBuild = build as RangerBuild;
  const { conversionPool } = common.commonContext;
  const activeTraits = getActiveTraits(rangerBuild.specializations || []).filter(
    (trait) => trait.name !== disabledTrait
  );
  const hasTrait = (name: string): boolean => activeTraits.some((trait) => trait.name === name);
  const traitDurations: Record<string, number> = {};
  const weapons = weaponSet === 2 ? rangerBuild.alternateWeapons : rangerBuild.weapons;
  const soulbeast = rangerBuild.specializations?.some((specialization) => specialization.name === 'Soulbeast');
  const attributeEffects: Gw2AttributeEffect[] = [
    {
      kind: 'flat',
      source: "Strider's Strength",
      to: 'Power',
      amount: weapons?.includes('Sword') ? 240 : 120,
      feedsConversions: false,
      enabled: hasTrait("Strider's Strength")
    },
    {
      kind: 'flat',
      source: 'Honed Axes',
      to: 'Ferocity',
      amount: weapons?.includes('Axe') ? 240 : 120,
      feedsConversions: false,
      enabled: hasTrait('Honed Axes')
    }
  ];
  if (soulbeast && hasTrait('Pack Alpha')) {
    for (const attribute of PACK_ALPHA_ATTRIBUTES) {
      attributeEffects.push({
        kind: 'flat',
        source: 'Pack Alpha',
        to: attribute,
        amount: 150,
        feedsConversions: false
      });
    }
  }

  const favoredWeapon = weapons?.some((weapon) => ['Dagger', 'Mace', 'Torch'].includes(weapon));
  attributeEffects.push(
    {
      kind: 'flat',
      source: "Pet's Prowess",
      to: 'Ferocity',
      amount: 300,
      feedsConversions: false,
      enabled: soulbeast && hasTrait("Pet's Prowess")
    },
    {
      kind: 'flat',
      source: 'Ambidexterity',
      to: 'Condition Damage',
      amount: favoredWeapon ? 240 : 120,
      feedsConversions: false,
      enabled: hasTrait('Ambidexterity')
    },
    {
      kind: 'flat',
      source: 'Arachnophobia',
      to: 'Expertise',
      amount: 150,
      feedsConversions: false,
      enabled: hasTrait('Arachnophobia')
    },
    {
      kind: 'flat',
      source: 'Lingering Magic',
      to: 'Concentration',
      amount: 240,
      feedsConversions: false,
      enabled: hasTrait('Lingering Magic')
    },
    {
      kind: 'flat',
      source: 'Natural Fortitude',
      to: 'Vitality',
      amount: 240,
      feedsConversions: false,
      enabled: hasTrait('Natural Fortitude')
    },
    {
      kind: 'conversion',
      source: 'Wellspring',
      from: 'Power',
      to: 'Healing Power',
      multiplier: 0.07,
      rounding: 'none',
      input: 'common',
      enabled: hasTrait('Wellspring')
    },
    {
      kind: 'flat',
      source: 'Vicious Quarry',
      to: 'Ferocity',
      amount: 250,
      feedsConversions: false,
      enabled: hasTrait('Vicious Quarry') && rangerBuild.assumptions?.fury !== false
    },
    {
      kind: 'flat',
      source: 'Signet of the Wild',
      to: 'Ferocity',
      amount: 180,
      feedsConversions: false,
      enabled: selectedSkills.some((skill) => skill.name === 'Signet of the Wild')
    }
  );
  if (soulbeast) {
    const archetype = selectedRangerPet(rangerBuild)?.archetype || '';
    for (const [attribute, amount] of Object.entries(SOULBEAST_ARCHETYPE_ATTRIBUTES[archetype] || {})) {
      attributeEffects.push({
        kind: 'flat',
        source: `Soulbeast ${archetype}`,
        to: attribute,
        amount,
        feedsConversions: false
      });
    }
  }

  const traitStats = resolveAttributeEffects(conversionPool, attributeEffects);

  return finalizeBuildAttributes(common, {
    activeTraits,
    traitStats,
    traitDurations
  });
}
