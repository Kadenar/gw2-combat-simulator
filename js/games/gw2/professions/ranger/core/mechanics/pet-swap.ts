import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
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

  state.activePet = pet.name;
  state.activePetSlot = slot;
  state.activePetSkillIds = [...pet.skillIds];
  state.petOpeningStrikeReady = true;
}
