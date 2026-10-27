import { attributeBonusNumber, requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { rangerPetForState } from '#gw2/professions/ranger/data/pets.js';
import { resolveAttributeContributions } from '#gw2/platform/attributes/evaluation.js';
import { ATTRIBUTE_NAMES } from '#gw2/platform/attributes/inputs.js';
import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import {
  criticalChanceFractionFromPrecision,
  criticalDamageMultiplierFromFerocity,
  STANDARD_TARGET_ARMOR
} from '#gw2/platform/combat/formulas.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';

import { rangerPetAutoProfile, rangerPetBaseAttributes } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import {
  beastlyWardenPetDamageMultiplier,
  beastmasteryPetAttributes
} from '#gw2/professions/ranger/core/traits/beastmastery/pet-attributes.js';
import { skirmishingPetAttributes } from '#gw2/professions/ranger/core/traits/skirmishing/pet-attributes.js';
import { wildernessPetAttributes } from '#gw2/professions/ranger/core/traits/wilderness-survival/attributes.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime } from '#gw2/professions/ranger/types.js';

export function rangerPetCompanionId(context: Pick<MechanicQueriesOf<RangerRuntime>, 'profession'>): string {
  const state = professionCoreState(context);

  if (!state.pet) throw new Error('An active pet is required for companion identity.');

  return state.pet.id;
}

/** Selected Signet of the Wild grants ferocity only while ready; callers supply their own observation clock. */
function signetOfTheWildBonus(context: unknown, selected: boolean, ready = true): number {
  return selected && ready
    ? attributeBonusNumber(requireSkillFromContext(context, ID.SIGNET_OF_THE_WILD), 'ferocity')
    : 0;
}

/** Snapshot independent-pet attributes after trait inheritance and the live signet passive. */
function rangerPetAttributes(context: RangerRuntime | RangerResolverContext) {
  const pet = rangerPetForState(professionCoreState(context));
  const attributes = { ...rangerPetBaseAttributes(pet.name) };
  const family = pet.family;
  const bonuses = resolveAttributeContributions({ conversionPool: {}, conversions: [] }, [
    {
      attributeEffects: [
        ...beastmasteryPetAttributes(context),
        ...skirmishingPetAttributes(context, family),
        ...wildernessPetAttributes(context, family)
      ]
    }
  ]).attributes;
  for (const key of Object.keys(attributes) as (keyof typeof attributes)[])
    attributes[key] += bonuses[ATTRIBUTE_NAMES[key]] ?? 0;
  const runtime = 'cooldownController' in context ? context : null;

  if (runtime)
    attributes.ferocity += signetOfTheWildBonus(
      context,
      selectedSkillIdSet(runtime.config.selectedSkillIds).has(ID.SIGNET_OF_THE_WILD),
      (runtime.cooldownController.readyAt(ID.SIGNET_OF_THE_WILD) || 0) <= runtime.time
    );

  return attributes;
}

/** Pet combat packets retain companion identity and only the trait-derived attributes consumed by damage rules. */
export function rangerPetCombatMetadata(context: RangerRuntime | RangerResolverContext) {
  const attributes = rangerPetAttributes(context);
  // New families may declare a different pet weapon without changing established damage baselines.
  const weaponStrength =
    rangerPetAutoProfile(rangerPetForState(professionCoreState(context)).name)?.weaponStrength ?? 2880;
  return {
    weaponStrength: undefined,
    weaponStrengthProfileId: undefined,
    independentSummonStrike: true,
    independentConditionOwner: true,
    summonUsesProfessionModifiers: true,
    summonBasePower: attributes.power,
    summonBasePrecision: attributes.precision,
    summonBaseFerocity: attributes.ferocity,
    summonBaseConditionDamage: attributes.conditionDamage,
    summonBaseExpertise: attributes.expertise,
    summonOwner: rangerPetCompanionId(context),
    entityName: rangerPetForState(professionCoreState(context)).name,
    // Pets crit like players: the level-80 base chance plus Precision above the baseline, matching the pet panel.
    summonCriticalChance: criticalChanceFractionFromPrecision(attributes.precision),
    // Share the canonical Ferocity scaling so pet critical damage stays aligned with combat formulas.
    summonCriticalDamage: criticalDamageMultiplierFromFerocity(attributes.ferocity),
    summonDamagePerCoefficient:
      ((weaponStrength * attributes.power) / STANDARD_TARGET_ARMOR) * beastlyWardenPetDamageMultiplier(context)
  };
}
