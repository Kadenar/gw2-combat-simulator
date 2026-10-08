import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { STANDARD_TARGET_ARMOR } from '#gw2/platform/combat/formulas.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { rangerPetBaseAttributes } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import { signetOfTheWildBonus } from '#gw2/professions/ranger/core/skills/signet-passives.js';
import {
  applyHonedAxesPet,
  applyPackAlphaPet,
  applyPetsProwessPet,
  beastlyWardenPetDamageMultiplier
} from '#gw2/professions/ranger/core/traits/beastmastery/pet-attributes.js';
import {
  applyFangAndClawPet,
  applyStridersStrengthPet
} from '#gw2/professions/ranger/core/traits/skirmishing/attributes.js';
import { applyArachnophobiaPet } from '#gw2/professions/ranger/core/traits/wilderness-survival/attributes.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime } from '#gw2/professions/ranger/types.js';

export function rangerPetCompanionId(context: Pick<MechanicQueriesOf<RangerRuntime>, 'profession'>): string {
  const state = professionCoreState(context);
  return `ranger-pet:${state.activePetSlot}:${state.petAutoGeneration}`;
}

function petHasSelectedSkill(context: RangerRuntime, skillId: number): boolean {
  return selectedSkillIdSet(context.config.selectedSkillIds).has(skillId);
}

/** Snapshot independent-pet attributes after trait inheritance and the live signet passive. */
function rangerPetAttributes(context: RangerRuntime | RangerResolverContext) {
  const petName = professionCoreState(context).activePet;
  const attributes = { ...rangerPetBaseAttributes(petName) };
  applyPackAlphaPet(context, attributes);
  applyStridersStrengthPet(context, attributes);
  applyHonedAxesPet(context, attributes);
  applyPetsProwessPet(context, attributes);
  applyFangAndClawPet(context, attributes, petName);
  applyArachnophobiaPet(context, attributes, petName);
  const runtime = 'cooldownController' in context ? context : null;
  if (runtime)
    attributes.ferocity += signetOfTheWildBonus(
      context,
      petHasSelectedSkill(runtime, ID.SIGNET_OF_THE_WILD),
      (runtime.cooldownController.readyAt(ID.SIGNET_OF_THE_WILD) || 0) <= runtime.time
    );
  return attributes;
}

/** Pet combat packets always retain the active companion's identity and trait-derived attributes. */
export function rangerPetCombatMetadata(context: RangerRuntime | RangerResolverContext) {
  const attributes = rangerPetAttributes(context);
  return {
    weaponStrength: undefined,
    weaponStrengthProfileId: undefined,
    independentSummonStrike: true,
    independentConditionOwner: true,
    summonUsesProfessionModifiers: true,
    summonBasePower: attributes.power,
    summonBasePrecision: attributes.precision,
    summonBaseToughness: attributes.toughness,
    summonBaseVitality: attributes.vitality,
    summonBaseFerocity: attributes.ferocity,
    summonBaseConditionDamage: attributes.conditionDamage,
    summonBaseExpertise: attributes.expertise,
    summonBaseHealingPower: attributes.healingPower,
    summonOwner: rangerPetCompanionId(context),
    summonCriticalChance: (attributes.precision - 1000) / 2100,
    summonCriticalDamage: 1.5 + attributes.ferocity / 1500,
    summonDamagePerCoefficient:
      ((2880 * attributes.power) / STANDARD_TARGET_ARMOR) * beastlyWardenPetDamageMultiplier(context)
  };
}
