import { createPublicStateProjector, readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { ActivationClaims } from '#gw2/platform/combat/procs/activation-claims.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { createRangerPetState, type RangerPetState } from '#gw2/professions/ranger/core/mechanics/pet-state.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RangerConfig, RangerState } from '#gw2/professions/ranger/types.js';

export interface RangerCoreState {
  activePet: string;
  activePetSlot: 1 | 2;
  petNames: [string, string];
  activePetSkillIds: SkillId[];
  pet: RangerPetState | null;
  nextPetInstance: number;
  endurance: ResourceClock;
  availableFlips: SkillFlipWindows;
  stealthUntil: number;
  revealedUntil: number;
  autoattackChains: Record<string, SkillId>;
  winterBiteReady: boolean;

  quickDraw: ChargeGrant;
  activationClaims: ActivationClaims;
  pendingFrostTrapEvents: SimulationEventBase[];
  bloodThirst: ChargeGrant;

  playerOpeningStrikeReady: boolean;
  playerPoisonMasterReady: boolean;
  playerPoisonousStrikes: ChargeGrant;
  sharpeningStoneGrants: ChargeGrant[];
}

export function selectedRangerPet(config: RangerConfig = {}, slot: 1 | 2 = 1) {
  const selected = slot === 2 ? config.selectedPet2 || 'Lynx' : config.selectedPet || 'Pig';
  return RANGER_PETS.find((pet) => pet.name === selected) || RANGER_PETS[0];
}

export function rangerPetByName(name: string) {
  return RANGER_PETS.find((pet) => pet.name === name) || RANGER_PETS[0];
}

// Initialize player resources and a separately owned first pet lifetime from the build selections.
export function createRangerCoreState(config: RangerConfig = {}): RangerCoreState {
  const pet = selectedRangerPet(config);
  const pet2 = selectedRangerPet(config, 2);
  return {
    activePet: pet?.name || '',
    activePetSlot: 1,
    petNames: [pet?.name || '', pet2?.name || ''],
    activePetSkillIds: [...(pet?.skillIds || [])],
    pet: createRangerPetState('ranger-pet:1:0'),
    nextPetInstance: 1,
    endurance: createResourceClock(100),
    availableFlips: {},
    stealthUntil: 0,
    revealedUntil: 0,
    autoattackChains: {},
    winterBiteReady: false,

    quickDraw: grantCharges(0, 0),
    activationClaims: {},
    pendingFrostTrapEvents: [],
    bloodThirst: grantCharges(0, 0),

    playerOpeningStrikeReady: true,
    playerPoisonMasterReady: false,
    playerPoisonousStrikes: grantCharges(0, 0),
    sharpeningStoneGrants: []
  };
}

// Publish pet identity and visible state; pet scheduling remains private to the live execution owner.
const RANGER_PLAYER_PUBLIC_STATE_KEYS: readonly (keyof RangerState)[] = Object.freeze([
  'activePet',
  'activePetSlot',
  'petNames',
  'activePetSkillIds',
  'endurance',

  'availableFlips',
  'stealthUntil',
  'revealedUntil',
  'autoattackChains',
  'winterBiteReady',

  'quickDraw',

  'sharpeningStoneGrants'
]);

export const RANGER_CORE_PUBLIC_END_STATE_KEYS: readonly (keyof RangerState)[] = Object.freeze([
  ...RANGER_PLAYER_PUBLIC_STATE_KEYS,
  'pet'
]);

/** Publish pet identity and visible rewards without copying scheduler internals or live effect stores. */
const projectPlayerState = createPublicStateProjector({
  keys: RANGER_PLAYER_PUBLIC_STATE_KEYS,
  defaults: {}
});

export function projectRangerCoreState(input: Gw2PlanningStateInput) {
  const { pet } = readProfessionCoreState<RangerCoreState>(input.profession);
  const state = projectPlayerState(input);
  return {
    ...state,
    pet: pet
      ? { id: pet.id, ferociousSymbiosis: { ...pet.ferociousSymbiosis }, wutheringWindReady: pet.wutheringWindReady }
      : null
  };
}
