import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import type { RangerPetDefinition, RangerResolverContext } from '#gw2/professions/ranger/types.js';

/** Retire outgoing boons and conditions before installing the already-resolved incoming pet. */
export function applyRangerPetSwap(
  context: RangerResolverContext,
  pet: RangerPetDefinition,
  slot: 1 | 2,
  at: number
): void {
  const state = professionCoreState(context);
  const outgoingCompanionId = rangerPetCompanionId(context);
  context.combat.retireCompanion(outgoingCompanionId, at);

  // Unspent Poisonous Strikes belong to the outgoing pet and are lost on swap, including when it returns.
  state.poisonousStrikes = grantCharges(0, 0);
  // The incoming companion cannot inherit an unused Poison Master grant from the retired pet.
  state.poisonMasterAttackOwner = null;

  state.activePet = pet.name;
  state.activePetSlot = slot;
  state.activePetSkillIds = [...pet.skillIds];
  state.petOpeningStrikeReady = true;
}
