import type { ActivationClaims } from '#gw2/platform/combat/procs/activation-claims.js';
import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';

/** Trait and skill readiness that the player and each pet lifetime hold independently; rewards never transfer. */
export interface RangerActorProcState {
  activationClaims: ActivationClaims;
  openingStrikeReady: boolean;
  poisonMasterReady: boolean;
  poisonousStrikes: ChargeGrant;
}

/** Every actor, including each new pet lifetime, starts with Opening Strike armed and no pending grants. */
export function createRangerActorProcState(): RangerActorProcState {
  return {
    activationClaims: {},
    openingStrikeReady: true,
    poisonMasterReady: false,
    poisonousStrikes: grantCharges(0, 0)
  };
}

/** Delayed pet packets resolve only to the lifetime that launched them; a replacement pet never inherits them. */
export function rangerOwningPetState<TPet extends { readonly id: string }>(
  pet: TPet | null,
  summonOwner: unknown
): TPet | null {
  return pet && pet.id === summonOwner ? pet : null;
}
