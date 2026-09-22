import { THIEF_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/thief/core/profiles.js';
import { thiefCatalog } from '#gw2/professions/thief/catalog.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { balanceProfileNumberFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { getActiveTraits } from '#gw2/professions/thief/data/traits-data.js';
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
import type { ThiefBuild } from '#gw2/professions/thief/types.js';

function wields(build: ThiefBuild, weapon: string, weaponSet: number): boolean {
  const weapons = weaponSet === 2 ? build.alternateWeapons : build.weapons;

  return (weapons || []).includes(weapon);
}

export function applyThiefBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  { build, selectedSkills = [], weaponSet = 1, disabledTrait = null, balanceContext }: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const thiefBuild = build as ThiefBuild;

  const { activeTraits, hasTrait, hasSelectedSkill } = createBuildAttributeContext({
    specializations: thiefBuild.specializations || [],
    selectedSkills,
    disabledTrait,
    getActiveTraits
  });

  // Build previews and simulation tooltips use the same selected patch values.
  const profileContext = balanceContext ?? { catalog: thiefCatalog };

  const traitDurations: Gw2NumericAttributes = {};

  const attributeEffects: readonly Gw2AttributeEffect[] = [
    {
      kind: 'flat',
      source: 'Dagger Training',
      to: 'Power',
      amount: balanceProfileNumberFromContext(
        profileContext,
        TRAIT.DAGGER_TRAINING,
        wields(thiefBuild, 'Dagger', weaponSet) ? 'weaponAttributeBonus' : 'attributeBonus'
      ),
      feedsConversions: true,
      enabled: hasTrait('Dagger Training')
    },
    {
      kind: 'flat',
      source: 'Deadly Ambition',
      to: 'Condition Damage',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.DEADLY_AMBITION, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait('Deadly Ambition')
    },
    {
      kind: 'flat',
      source: 'Revealed Training',
      to: 'Power',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.REVEALED_TRAINING, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Revealed Training')
    },
    {
      kind: 'flat',
      source: 'No Quarter',
      to: 'Ferocity',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.NO_QUARTER, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('No Quarter') && Boolean(thiefBuild.assumptions?.fury)
    },
    {
      kind: 'flat',
      source: 'Preparedness',
      to: 'Expertise',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.PREPAREDNESS, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait('Preparedness')
    },
    {
      kind: 'flat',
      source: 'Staff Master',
      to: 'Power',
      amount: balanceProfileNumberFromContext(
        profileContext,
        TRAIT.STAFF_MASTER,
        wields(thiefBuild, 'Staff', weaponSet) ? 'weaponAttributeBonus' : 'attributeBonus'
      ),
      feedsConversions: true,
      enabled: hasTrait('Staff Master')
    },
    {
      kind: 'flat',
      source: "Swindler's Equilibrium",
      to: 'Power',
      amount: balanceProfileNumberFromContext(
        profileContext,
        TRAIT.SWINDLERS_EQUILIBRIUM,
        wields(thiefBuild, 'Sword', weaponSet) ? 'weaponAttributeBonus' : 'attributeBonus'
      ),
      feedsConversions: true,
      enabled: hasTrait("Swindler's Equilibrium")
    },
    {
      kind: 'flat',
      source: 'Silent Scope',
      to: 'Precision',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.SILENT_SCOPE, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait('Silent Scope')
    },
    {
      kind: 'flat',
      source: 'Premeditation',
      to: 'Concentration',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.PREMEDITATION, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Premeditation')
    },
    {
      kind: 'flat',
      source: 'Second Opinion',
      to: 'Condition Damage',
      amount:
        balanceProfileNumberFromContext(profileContext, TRAIT.SECOND_OPINION, 'attributeBonus') +
        (wields(thiefBuild, 'Scepter', weaponSet)
          ? balanceProfileNumberFromContext(profileContext, TRAIT.SECOND_OPINION, 'attributePerStack')
          : 0),
      feedsConversions: true,
      enabled: hasTrait('Second Opinion')
    },
    {
      kind: 'conversion',
      source: 'Practiced Tolerance',
      from: 'Precision',
      to: 'Ferocity',
      multiplier: balanceProfileNumberFromContext(profileContext, TRAIT.PRACTICED_TOLERANCE, 'attributeConversion'),
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait('Practiced Tolerance')
    },
    {
      kind: 'conversion',
      source: "Marauder's Resilience",
      from: 'Power',
      to: 'Vitality',
      multiplier: balanceProfileNumberFromContext(profileContext, TRAIT.MARAUDERS_RESILIENCE, 'attributeConversion'),
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait("Marauder's Resilience")
    },
    {
      kind: 'conversion',
      source: 'Second Opinion',
      from: 'Condition Damage',
      to: 'Healing Power',
      multiplier: balanceProfileNumberFromContext(profileContext, TRAIT.SECOND_OPINION, 'attributeConversion'),
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait('Second Opinion')
    },
    {
      kind: 'conversion',
      source: 'Strength of Shadows',
      from: 'Vitality',
      to: 'Expertise',
      multiplier: balanceProfileNumberFromContext(profileContext, TRAIT.STRENGTH_OF_SHADOWS, 'attributeConversion'),
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait('Strength of Shadows')
    },
    {
      kind: 'flat',
      source: "Assassin's Signet",
      to: 'Power',
      amount: balanceProfileNumberFromContext(profileContext, 'thief.core.assassins-signet', 'attributeBonus'),
      feedsConversions: false,
      enabled: hasSelectedSkill("Assassin's Signet")
    },
    {
      // The equipped signet contributes panel precision while its passive is available.
      kind: 'flat',
      source: 'Signet of Agility',
      to: 'Precision',
      amount: balanceProfileNumberFromContext(profileContext, CORE.signetOfAgility, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasSelectedSkill('Signet of Agility')
    }
  ];

  // Static condition-duration traits belong in panel stats so simulation provenance can prevent rebaking them.
  if (hasTrait('Potent Poison')) {
    traitDurations['Poison Duration'] =
      100 * balanceProfileNumberFromContext(profileContext, TRAIT.POTENT_POISON, 'conditionDurationBonus');
  }

  return finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations
  });
}
