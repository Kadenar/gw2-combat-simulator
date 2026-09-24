import { type SkillFlipWindows } from '#gw2/platform/engine/skills/skill-flips.js';
import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { RangerConfig, RangerState } from '#gw2/professions/ranger/types.js';

export interface RangerCoreState {
  activePet: string;
  activePetSlot: 1 | 2;
  petNames: [string, string];
  activePetSkillIds: SkillId[];
  petActive: boolean;
  endurance: number;

  enduranceUpdatedAt: number;
  availableFlips: SkillFlipWindows;
  stealthUntil: number;
  revealedUntil: number;
  autoattackChains: Record<string, SkillId>;
  winterBiteReady: boolean;
  tailWindReadyAt: number;
  furiousGripReadyAt: number;
  sharpenedEdgesProgress: number;
  quickDrawReadyAt: number;
  quickDrawUntil: number;
  trapCrippleActivations: Record<string, boolean>;
  pendingFrostTrapEvents: SimulationEventBase[];
  bloodThirst: ChargeGrant;
  rejuvenationReadyAt: number;
  childOfEarthReadyAt: number;
  clarionBondReadyAt: number;
  carnivoreReadyAt: number;
  goForTheThroatPetReadyAt: number;
  huntersGazeReadyAt: number;
  playerOpeningStrikeReady: boolean;
  petOpeningStrikeReady: boolean;
  poisonMasterPetAttackReady: boolean;
  poisonousStrikes: ChargeGrant;
  sharpeningStoneExpirations: number[];
  petSwapCount: number;
  petAutoGeneration: number;
  petAutoNextAt: number;
  petAutoBusyUntil: number;
  petAutoCooldowns: Record<string, number>;
  petAutoActivationUses: Record<string, number>;
  petAutoActivationCounts: [number, number];
  petAutoOpeningBasic: boolean;
  petCommandReadyAt: number;
  petCommandCooldowns: Record<string, number>;
  petCommandDelays: Record<string, number>;
}

export function selectedRangerPet(config: RangerConfig = {}, slot: 1 | 2 = 1) {
  const selected = String(slot === 2 ? config.selectedPet2 || 'Lynx' : config.selectedPet || 'Pig');
  return RANGER_PETS.find((pet) => pet.name === selected) || RANGER_PETS[0];
}

export function rangerPetByName(name: string) {
  return RANGER_PETS.find((pet) => pet.name === name) || RANGER_PETS[0];
}

// Initialize complete Ranger resource, pet-generation, weapon-chain, flip, and
// trait state from bounded build defaults.
export function createRangerCoreState(config: RangerConfig = {}): RangerCoreState {
  const pet = selectedRangerPet(config);
  const pet2 = selectedRangerPet(config, 2);
  return {
    activePet: pet?.name || '',
    activePetSlot: 1,
    petNames: [pet?.name || '', pet2?.name || ''],
    activePetSkillIds: [...(pet?.skillIds || [])],
    petActive: true,
    endurance: 100,

    enduranceUpdatedAt: 0,
    availableFlips: {},
    stealthUntil: 0,
    revealedUntil: 0,
    autoattackChains: {},
    winterBiteReady: false,
    tailWindReadyAt: 0,
    furiousGripReadyAt: 0,
    sharpenedEdgesProgress: 0,
    quickDrawReadyAt: 0,
    quickDrawUntil: 0,
    trapCrippleActivations: {},
    pendingFrostTrapEvents: [],
    bloodThirst: grantCharges(0, 0),
    rejuvenationReadyAt: 0,
    childOfEarthReadyAt: 0,
    clarionBondReadyAt: 0,
    carnivoreReadyAt: 0,
    goForTheThroatPetReadyAt: 0,
    huntersGazeReadyAt: 0,
    playerOpeningStrikeReady: true,
    petOpeningStrikeReady: true,
    poisonMasterPetAttackReady: false,
    poisonousStrikes: grantCharges(0, 0),
    sharpeningStoneExpirations: [],
    petSwapCount: 0,
    petAutoGeneration: 0,
    petAutoNextAt: 0,
    petAutoBusyUntil: 0,
    petAutoCooldowns: {},
    petAutoActivationUses: {},
    petAutoActivationCounts: [1, 0],
    petAutoOpeningBasic: true,
    petCommandReadyAt: 0,
    petCommandCooldowns: {},
    petCommandDelays: {}
  };
}

// Core declares only the public state fields that it semantically owns.
export const RANGER_CORE_PUBLIC_END_STATE_KEYS: readonly (keyof RangerState)[] = Object.freeze([
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
  'tailWindReadyAt',
  'furiousGripReadyAt',
  'sharpenedEdgesProgress',
  'quickDrawReadyAt',
  'quickDrawUntil',
  'trapCrippleActivations',
  'rejuvenationReadyAt',
  'childOfEarthReadyAt',
  'sharpeningStoneExpirations',
  'clarionBondReadyAt',
  'petSwapCount',
  'petAutoNextAt',
  'petAutoBusyUntil',
  'petAutoCooldowns'
]);

// Core fields have no inactive fallbacks; their values come from the live state.
export const RANGER_CORE_PUBLIC_STATE_PROJECTION = Object.freeze({
  keys: RANGER_CORE_PUBLIC_END_STATE_KEYS,
  defaults: {}
});
