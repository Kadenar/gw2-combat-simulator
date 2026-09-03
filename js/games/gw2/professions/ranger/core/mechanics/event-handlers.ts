import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import type { RangerResolverContext, RangerResolverEvent } from '#gw2/professions/ranger/types.js';

export function handleRangerBloodThirst(context: RangerResolverContext, event: RangerResolverEvent): void {
  professionCoreState(context).bloodThirstCharges = Math.max(0, Number(event.charges || 0));
}

export function handleRangerWinterBiteReady(context: RangerResolverContext, _event: RangerResolverEvent): void {
  professionCoreState(context).winterBiteReady = true;
}

export function handleRangerBeastSkillUsed(context: RangerResolverContext, _event: RangerResolverEvent): void {
  if (hasTrait(context, TRAIT.POISON_MASTER)) {
    professionCoreState(context).poisonMasterPetAttackReady = true;
  }
}

export function handleRangerPoisonousStrikes(context: RangerResolverContext, event: RangerResolverEvent): void {
  const state = professionCoreState(context);
  state.poisonousStrikesCharges = Math.max(0, Number(event.charges || 0));
  state.poisonousStrikesExpiresAt = event.at + Number(event.duration || 0);
}

export function handleRangerSharpeningStone(context: RangerResolverContext, event: RangerResolverEvent): void {
  const state = professionCoreState(context);
  state.sharpeningStoneCharges = Math.max(0, Number(event.charges || 0));
  state.sharpeningStoneExpiresAt = event.at + Number(event.duration || 0);
}

// Retire the outgoing companion's lingering conditions after the swap delay,
// then advance pet identity and generation state for subsequent attacks.
export function handleRangerPetSwapped(context: RangerResolverContext, event: RangerResolverEvent): void {
  const state = professionCoreState(context);
  const outgoingCompanionId = rangerPetCompanionId(context);
  const removedAt = event.at + 1;
  for (const application of context.conditionApplications) {
    if (
      application.source === 'ranger-pet' &&
      (!application.summonOwner || String(application.summonOwner) === outgoingCompanionId) &&
      application.naturalExpiresAt > removedAt
    ) {
      application.removedAt = removedAt;
    }
  }

  for (const condition of context.conditionState.values()) {
    for (const stack of condition.stacks) {
      if (
        stack.application.source === 'ranger-pet' &&
        (!stack.application.summonOwner || String(stack.application.summonOwner) === outgoingCompanionId)
      ) {
        stack.expiresAt = Math.min(stack.expiresAt, removedAt);
      }
    }
  }

  state.petAutoGeneration += 1;
  const pet = rangerPetByName(String(event.activePet || ''));
  state.activePet = pet.name;
  state.activePetSlot = Number(event.activePetSlot) === 2 ? 2 : 1;
  state.activePetSkillIds = [...pet.skillIds];
  state.petOpeningStrikeReady = true;
}
