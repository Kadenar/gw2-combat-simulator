import { getActiveTraits } from '#gw2/professions/mesmer/data/traits-data.js';
import { addAttribute } from '#gw2/platform/builds/attributes.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/lib/build-attributes.js';
import type {
  Gw2AttributeEffect,
  Gw2CommonAttributeResult,
  Gw2BuildAttributeRuleContext,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes
} from '#gw2/platform/builds/types.js';
import type { MesmerBuild } from '#gw2/professions/mesmer/types.js';

// Fold Mesmer trait conversions, selected-signet bonuses, duration bonuses, and
// assumption-dependent critical chance into the shared build attribute result.
export function applyMesmerBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  { build, selectedSkills = [], disabledTrait = null }: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const mesmerBuild = build as MesmerBuild;
  const traitDurations: Gw2NumericAttributes = {};

  const { activeTraits, hasTrait, hasSelectedSkill, hasSelectedSkillId } = createBuildAttributeContext({
    specializations: mesmerBuild.specializations || [],
    selectedSkills,
    disabledTrait,
    getActiveTraits
  });

  const assumptions = mesmerBuild.assumptions || {};

  const attributeEffects: Gw2AttributeEffect[] = [
    {
      kind: 'conversion',
      source: 'Quiet Intensity',
      from: 'Vitality',
      to: 'Ferocity',
      multiplier: 0.1,
      rounding: 'round',
      input: 'common',
      enabled: hasTrait('Quiet Intensity')
    },
    {
      kind: 'flat',
      source: 'Chaotic Persistence',
      to: 'Expertise',
      amount: 100,
      feedsConversions: false,
      enabled: hasTrait('Chaotic Persistence') && assumptions.regeneration !== false
    },
    {
      kind: 'flat',
      source: 'Chaotic Persistence',
      to: 'Concentration',
      amount: 250,
      feedsConversions: false,
      enabled: hasTrait('Chaotic Persistence') && assumptions.regeneration !== false
    },
    {
      kind: 'flat',
      source: 'Sharpening Sorrow',
      to: 'Expertise',
      amount: 150,
      feedsConversions: false,
      enabled: hasTrait('Sharpening Sorrow') && assumptions.fury !== false
    },
    {
      kind: 'flat',
      source: 'Signet of Domination',
      to: 'Condition Damage',
      amount: 180,
      feedsConversions: false,
      enabled: hasSelectedSkillId(10232) || hasSelectedSkill('Signet of Domination')
    },
    {
      kind: 'flat',
      source: 'Signet of Midnight',
      to: 'Expertise',
      amount: 180,
      feedsConversions: false,
      enabled: hasSelectedSkillId(10234) || hasSelectedSkill('Signet of Midnight')
    }
  ];

  let traitCriticalChance = 0;

  for (const trait of activeTraits) {
    if (trait.conditionDamage) {
      attributeEffects.push({
        kind: 'flat',
        source: trait.name,
        to: 'Condition Damage',
        amount: Number(trait.conditionDamage),
        feedsConversions: false
      });
    }

    if (trait.ferocity) {
      attributeEffects.push({
        kind: 'flat',
        source: trait.name,
        to: 'Ferocity',
        amount: Number(trait.ferocity),
        feedsConversions: false
      });
    }

    if (trait.concentration) {
      attributeEffects.push({
        kind: 'flat',
        source: trait.name,
        to: 'Concentration',
        amount: Number(trait.concentration),
        feedsConversions: false
      });
    }

    if (trait.vitality) {
      attributeEffects.push({
        kind: 'flat',
        source: trait.name,
        to: 'Vitality',
        amount: Number(trait.vitality),
        feedsConversions: false
      });
    }

    if (trait.confusionDuration) {
      addAttribute(traitDurations, 'Confusion Duration', Number(trait.confusionDuration));
    }

    traitCriticalChance += Number(trait.criticalChance || 0);
  }

  if (hasTrait('Quiet Intensity') && assumptions.fury !== false) {
    traitCriticalChance += 15;
  }

  if (hasTrait('Flow of Time') && assumptions.alacrity !== false) {
    traitCriticalChance += 15;
  }

  return finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations,
    traitCriticalChance
  });
}
