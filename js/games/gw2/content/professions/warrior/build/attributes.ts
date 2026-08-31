import { getActiveTraits } from '#gw2/content/professions/warrior/data/traits-data.js';
import { createBuildAttributeContext, finalizeProfessionBuildAttributes } from '#gw2/content/professions/lib/build-attributes.js';
import type {
  Gw2BuildAttributeRuleContext,
  Gw2AttributeEffect,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes
} from '#gw2/platform/builds/types.js';
import type { WarriorSpecializationSelection } from '#gw2/content/professions/warrior/data/traits-data.js';

// Apply selected signets, weapon-sensitive traits, duration bonuses, and ordered
// Warrior conversions to the shared build-time attribute result.
export function applyWarriorBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  { build, selectedSkills = [], disabledTrait = null }: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const { activeTraits, hasTrait, hasSelectedSkill } = createBuildAttributeContext({
    specializations: (build.specializations || []) as WarriorSpecializationSelection[],
    selectedSkills,
    disabledTrait,
    getActiveTraits
  });

  const weapons = [...(build.weapons || []), ...(build.alternateWeapons || [])];

  const traitDurations: Gw2NumericAttributes = {};

  const attributeEffects: readonly Gw2AttributeEffect[] = [
    {
      kind: 'flat',
      source: 'Signet of Might',
      to: 'Power',
      amount: 180,
      feedsConversions: false,
      enabled: hasSelectedSkill('Signet of Might')
    },
    {
      kind: 'flat',
      source: 'Signet of Fury',
      to: 'Precision',
      amount: 180,
      feedsConversions: false,
      enabled: hasSelectedSkill('Signet of Fury')
    },
    {
      kind: 'flat',
      source: 'Forceful Greatsword',
      to: 'Power',
      amount: 120,
      feedsConversions: true,
      enabled: hasTrait('Forceful Greatsword')
    },
    {
      kind: 'flat',
      source: 'Forceful Greatsword',
      to: 'Power',
      amount: 120,
      feedsConversions: false,
      enabled: hasTrait('Forceful Greatsword') && weapons.includes('Greatsword')
    },
    {
      kind: 'conversion',
      source: 'Great Fortitude',
      from: 'Power',
      to: 'Vitality',
      multiplier: 0.1,
      rounding: 'none',
      input: 'eligible',
      enabled: hasTrait('Great Fortitude')
    },
    {
      kind: 'conversion',
      source: 'Great Fortitude',
      from: 'Power',
      to: 'Ferocity',
      multiplier: 0.1,
      rounding: 'none',
      input: 'eligible',
      enabled: hasTrait('Great Fortitude')
    },
    {
      kind: 'flat',
      source: 'Roaring Reveille',
      to: 'Concentration',
      amount: 120,
      feedsConversions: false,
      enabled: hasTrait('Roaring Reveille')
    },
    {
      kind: 'conversion',
      source: 'Vigorous Shouts',
      from: 'Power',
      to: 'Healing Power',
      multiplier: 0.1,
      rounding: 'none',
      input: 'eligible',
      enabled: hasTrait('Vigorous Shouts')
    },
    {
      kind: 'flat',
      source: 'Deep Strikes',
      to: 'Condition Damage',
      amount: 180,
      feedsConversions: false,
      enabled: hasTrait('Deep Strikes') && Boolean((build.assumptions as Record<string, unknown> | undefined)?.fury)
    },
    {
      kind: 'conversion',
      source: 'Wounding Precision',
      from: 'Precision',
      to: 'Expertise',
      multiplier: 0.07,
      rounding: 'none',
      input: 'eligible',
      enabled: hasTrait('Wounding Precision')
    },
    {
      kind: 'flat',
      source: 'Blademaster',
      to: 'Expertise',
      amount: 120,
      feedsConversions: false,
      enabled: hasTrait('Blademaster')
    },
    {
      kind: 'flat',
      source: 'Axe Mastery',
      to: 'Ferocity',
      amount: weapons.includes('Axe') ? 240 : 120,
      feedsConversions: false,
      enabled: hasTrait('Axe Mastery')
    },
    {
      kind: 'flat',
      source: 'Inspiring Implements',
      to: 'Concentration',
      amount: 180,
      feedsConversions: false,
      enabled: hasTrait('Inspiring Implements')
    }
  ];

  if (hasTrait('Bloodlust')) {
    traitDurations['Bleeding Duration'] = 33;
  }

  if (hasTrait('King of Fires')) {
    traitDurations['Burning Duration'] = 33;
  }

  return finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations
  });
}
