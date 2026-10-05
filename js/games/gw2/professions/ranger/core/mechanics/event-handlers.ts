import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import type { RangerResolverContext } from '#gw2/professions/ranger/types.js';

// Removal immediately ends the outgoing entity's boons and independent conditions.
export function handleRangerPetSwapped(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  const outgoingCompanionId = rangerPetCompanionId(context);
  context.combat.retireCompanion(outgoingCompanionId, event.at);

  const pet = rangerPetByName(String(event.activePet || ''));
  state.activePet = pet.name;
  state.activePetSlot = Number(event.activePetSlot) === 2 ? 2 : 1;
  state.activePetSkillIds = [...pet.skillIds];
  state.petOpeningStrikeReady = true;
}
