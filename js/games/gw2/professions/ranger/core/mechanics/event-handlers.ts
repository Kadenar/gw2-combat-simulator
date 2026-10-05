import { appendChargeGrant, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import type { RangerResolverContext } from '#gw2/professions/ranger/types.js';

export function handleRangerBloodThirst(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  // Crippling Shot replaces the remaining charges with a new finite grant.
  professionCoreState(context).bloodThirst = grantCharges(
    Math.max(0, Number(event.charges || 0)),
    event.at + (event.duration || 0)
  );
}

export function handleRangerPoisonousStrikes(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  // Double Arc replaces the shared pet/merged-player grant instead of accumulating charges.
  state.poisonousStrikes = grantCharges(Math.max(0, Number(event.charges || 0)), event.at + (event.duration || 0));
}

export function handleRangerSharpeningStone(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  // Recasts add charges without renewing the lifetime of the remaining stones.
  state.sharpeningStoneGrants = appendChargeGrant(
    state.sharpeningStoneGrants,
    grantCharges(Math.trunc(Math.max(0, Number(event.charges || 0))), event.at + (event.duration || 0)),
    event.at,
    'earliest-expiry'
  );
}

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
