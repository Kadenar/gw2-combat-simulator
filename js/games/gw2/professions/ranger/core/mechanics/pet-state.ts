import type { ActivationClaims } from '#gw2/platform/combat/procs/activation-claims.js';
import { createCompanionEffects, type CompanionEffects } from '#gw2/platform/combat/state/companion.js';
import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import type { RefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';

/** Every activation owns fresh combat state; cooldowns and immutable selection remain outside its lifetime. */
export interface RangerPetState {
  readonly id: string;
  activationClaims: ActivationClaims;
  readonly effects: CompanionEffects;
  openingStrikeReady: boolean;
  poisonMasterReady: boolean;
  paralyzingVenomUntil: number;
  sharpenSpines: ChargeGrant;
  poisonousStrikes: ChargeGrant;
  ferociousSymbiosis: RefreshedStacks;
  wutheringWindReady: boolean;
  wutheringWindReadyAt: number;
  autoStarted: boolean;
  autoNextAt: number;
  busyUntil: number;
  autoAction: { activationId: string; endsAt: number } | null;
  sequence: number;
  openingBasic: boolean;
  commandReadyAt: number;
}

/** Returning to a pet constructs defaults rather than restoring any earlier activation. */
export function createRangerPetState(id: string): RangerPetState {
  return {
    id,
    activationClaims: {},
    effects: createCompanionEffects(),
    openingStrikeReady: true,
    poisonMasterReady: false,
    paralyzingVenomUntil: 0,
    sharpenSpines: grantCharges(0, 0),
    poisonousStrikes: grantCharges(0, 0),
    ferociousSymbiosis: { stacks: 0, expiresAt: 0 },
    wutheringWindReady: false,
    wutheringWindReadyAt: 0,
    autoStarted: false,
    autoNextAt: 0,
    busyUntil: 0,
    autoAction: null,
    sequence: 0,
    openingBasic: true,
    commandReadyAt: 0
  };
}
