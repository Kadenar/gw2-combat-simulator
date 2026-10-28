import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import type { RefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';
import { createCompanionEffects, type CompanionEffects } from '#gw2/platform/combat/state/companion.js';
import {
  createRangerActorProcState,
  type RangerActorProcState
} from '#gw2/professions/ranger/core/mechanics/actor-state.js';

const RANGER_PET_ID_PREFIX = 'ranger-pet:';

/** Each pet lifetime gets a unique companion identity from its bar slot and activation count. */
export function rangerPetInstanceId(slot: 1 | 2, instance: number): string {
  return `${RANGER_PET_ID_PREFIX}${slot}:${instance}`;
}

/** Recognizes companion identities minted for Ranger pet lifetimes. */
export function isRangerPetInstanceId(id: unknown): id is string {
  return typeof id === 'string' && id.startsWith(RANGER_PET_ID_PREFIX);
}

/** Every activation owns fresh combat state; cooldowns and immutable selection remain outside its lifetime. */
export interface RangerPetState extends RangerActorProcState {
  readonly id: string;
  readonly effects: CompanionEffects;
  paralyzingVenom: ChargeGrant;
  sharpenSpines: ChargeGrant;
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
    ...createRangerActorProcState(),
    id,
    effects: createCompanionEffects(),
    paralyzingVenom: grantCharges(0, 0),
    sharpenSpines: grantCharges(0, 0),
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
