import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import type { RangerConfig, RangerCoreState, RangerState } from '#gw2/professions/ranger/types.js';

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
    maximumEndurance: 100,
    enduranceUpdatedAt: 0,
    availableFlips: {},
    autoattackChains: {},
    winterBiteReady: false,
    tailWindReadyAt: 0,
    furiousGripReadyAt: 0,
    sharpenedEdgesProgress: 0,
    quickDrawReadyAt: 0,
    quickDrawUntil: 0,
    trapCrippleActivations: {},
    bloodThirstCharges: 0,
    rejuvenationReadyAt: 0,
    childOfEarthReadyAt: 0,
    clarionBondReadyAt: 0,
    carnivoreReadyAt: 0,
    goForTheThroatPetReadyAt: 0,
    huntersGazeReadyAt: 0,
    playerOpeningStrikeReady: true,
    petOpeningStrikeReady: true,
    poisonMasterPetAttackReady: false,
    poisonousStrikesCharges: 0,
    poisonousStrikesExpiresAt: 0,
    sharpeningStoneCharges: 0,
    sharpeningStoneExpiresAt: 0,
    petSwapCount: 0,
    petAutoGeneration: 0,
    petAutoNextAt: 0,
    petAutoBusyUntil: 0,
    petAutoCooldowns: {},
    petAutoActivationUses: {},
    petAutoActivationCounts: [1, 0],
    petAutoOpeningBasic: true,
    petAutoTaskId: '',
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
  'maximumEndurance',
  'availableFlips',
  'autoattackChains',
  'winterBiteReady',
  'tailWindReadyAt',
  'furiousGripReadyAt',
  'sharpenedEdgesProgress',
  'quickDrawReadyAt',
  'quickDrawUntil',
  'trapCrippleActivations',
  'bloodThirstCharges',
  'rejuvenationReadyAt',
  'childOfEarthReadyAt',
  'poisonousStrikesCharges',
  'poisonousStrikesExpiresAt',
  'sharpeningStoneCharges',
  'sharpeningStoneExpiresAt',
  'clarionBondReadyAt',
  'petSwapCount',
  'petAutoNextAt',
  'petAutoBusyUntil',
  'petAutoCooldowns'
]);
