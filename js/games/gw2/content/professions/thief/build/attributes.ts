import { getActiveTraits } from '../data/traits-data.js';
import { createBuildAttributeContext, finalizeProfessionBuildAttributes } from '../../lib/build-attributes.js';
import type {
  Gw2BuildAttributeRuleContext,
  Gw2AttributeEffect,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes
} from '../../../../platform/builds/types.js';
import type { ThiefBuild } from '../types.js';

function wields(build: ThiefBuild, weapon: string, weaponSet: number): boolean {
  const weapons = weaponSet === 2 ? build.alternateWeapons : build.weapons;

  return (weapons || []).includes(weapon);
}

export function applyThiefBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  { build, selectedSkills = [], weaponSet = 1, disabledTrait = null }: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const thiefBuild = build as ThiefBuild;

  const { activeTraits, hasTrait, hasSelectedSkill } = createBuildAttributeContext({
    specializations: thiefBuild.specializations || [],
    selectedSkills,
    disabledTrait,
    getActiveTraits
  });

  const traitDurations: Gw2NumericAttributes = {};

  const attributeEffects: readonly Gw2AttributeEffect[] = [
    {
      kind: 'flat',
      source: 'Dagger Training',
      to: 'Power',
      amount: wields(thiefBuild, 'Dagger', weaponSet) ? 160 : 80,
      feedsConversions: true,
      enabled: hasTrait('Dagger Training')
    },
    {
      kind: 'flat',
      source: 'Deadly Ambition',
      to: 'Condition Damage',
      amount: 180,
      feedsConversions: true,
      enabled: hasTrait('Deadly Ambition')
    },
    {
      kind: 'flat',
      source: 'Revealed Training',
      to: 'Power',
      amount: 80,
      feedsConversions: false,
      enabled: hasTrait('Revealed Training')
    },
    {
      kind: 'flat',
      source: 'No Quarter',
      to: 'Ferocity',
      amount: 250,
      feedsConversions: false,
      enabled: hasTrait('No Quarter') && Boolean(thiefBuild.assumptions?.fury)
    },
    {
      kind: 'flat',
      source: 'Preparedness',
      to: 'Expertise',
      amount: 150,
      feedsConversions: true,
      enabled: hasTrait('Preparedness')
    },
    {
      kind: 'flat',
      source: 'Staff Master',
      to: 'Power',
      amount: wields(thiefBuild, 'Staff', weaponSet) ? 240 : 120,
      feedsConversions: true,
      enabled: hasTrait('Staff Master')
    },
    {
      kind: 'flat',
      source: "Swindler's Equilibrium",
      to: 'Power',
      amount: wields(thiefBuild, 'Sword', weaponSet) ? 240 : 120,
      feedsConversions: true,
      enabled: hasTrait("Swindler's Equilibrium")
    },
    {
      kind: 'flat',
      source: 'Silent Scope',
      to: 'Precision',
      amount: 120,
      feedsConversions: true,
      enabled: hasTrait('Silent Scope')
    },
    {
      kind: 'flat',
      source: 'Premeditation',
      to: 'Concentration',
      amount: 180,
      feedsConversions: false,
      enabled: hasTrait('Premeditation')
    },
    {
      kind: 'flat',
      source: 'Second Opinion',
      to: 'Condition Damage',
      amount: wields(thiefBuild, 'Scepter', weaponSet) ? 180 : 90,
      feedsConversions: true,
      enabled: hasTrait('Second Opinion')
    },
    {
      kind: 'conversion',
      source: 'Practiced Tolerance',
      from: 'Precision',
      to: 'Ferocity',
      multiplier: 0.1,
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait('Practiced Tolerance')
    },
    {
      kind: 'conversion',
      source: "Marauder's Resilience",
      from: 'Power',
      to: 'Vitality',
      multiplier: 0.07,
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait("Marauder's Resilience")
    },
    {
      kind: 'conversion',
      source: 'Second Opinion',
      from: 'Condition Damage',
      to: 'Healing Power',
      multiplier: 0.07,
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait('Second Opinion')
    },
    {
      kind: 'conversion',
      source: 'Strength of Shadows',
      from: 'Vitality',
      to: 'Expertise',
      multiplier: 0.13,
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait('Strength of Shadows')
    },
    {
      kind: 'flat',
      source: "Assassin's Signet",
      to: 'Power',
      amount: 180,
      feedsConversions: false,
      enabled: hasSelectedSkill("Assassin's Signet")
    }
  ];

  // Static condition-duration traits belong in panel stats so simulation provenance can prevent rebaking them.
  if (hasTrait('Potent Poison')) {
    traitDurations['Poison Duration'] = 33;
  }

  return finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations
  });
}
