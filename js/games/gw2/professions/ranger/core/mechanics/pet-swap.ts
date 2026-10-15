import { retireRangerPet, setRangerPetActive } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerPetDefinition, RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Swap whole lifetimes before observers grant rewards to the incoming pet. */
export function applyRangerPetSwap(context: RangerRuntime, pet: RangerPetDefinition, slot: 1 | 2): void {
  retireRangerPet(context, ID.PET_SWAP);
  const state = context.profession.core;
  state.activePet = pet.name;
  state.activePetSlot = slot;
  state.activePetSkillIds = [...pet.skillIds];
  setRangerPetActive(context, true, ID.PET_SWAP);
}
