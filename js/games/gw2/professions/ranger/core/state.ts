import type { ActivationClaims } from '#gw2/platform/combat/procs/activation-claims.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RechargeProgress } from '#gw2/platform/combat/recharge.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RangerConfig, RangerState } from '#gw2/professions/ranger/types.js';

export interface RangerCoreState {
  activePet: string;
  activePetSlot: 1 | 2;
  petNames: [string, string];
  activePetSkillIds: SkillId[];
  petActive: boolean;
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
  petOpeningStrikeReady: boolean;
  poisonMasterPetAttackReady: boolean;
  paralyzingVenomUntil: number;
  poisonousStrikes: ChargeGrant;
  sharpeningStoneGrants: ChargeGrant[];
  petSwapCount: number;
  petAutoGeneration: number;
  petAutoNextAt: number;
  petAutoBusyUntil: number;
  petAutoAction: { activationId: string; endsAt: number } | null;
  petAutoSequence: number;
  petAutoCooldowns: Record<string, number>;
  petAutoActivationUses: Record<string, number>;
  petAutoActivationCounts: [number, number];
  petAutoOpeningBasic: boolean;
  petCommandReadyAt: number;
  petCommandRecharges: Record<string, RechargeProgress>;
}

export function selectedRangerPet(config: RangerConfig = {}, slot: 1 | 2 = 1) {
  const selected = slot === 2 ? config.selectedPet2 || 'Lynx' : config.selectedPet || 'Pig';
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
    petOpeningStrikeReady: true,
    poisonMasterPetAttackReady: false,
    paralyzingVenomUntil: 0,
    poisonousStrikes: grantCharges(0, 0),
    sharpeningStoneGrants: [],
    petSwapCount: 0,
    petAutoGeneration: 0,
    petAutoNextAt: 0,
    petAutoBusyUntil: 0,
    petAutoAction: null,
    petAutoSequence: 0,
    petAutoCooldowns: {},
    petAutoActivationUses: {},
    petAutoActivationCounts: [1, 0],
    petAutoOpeningBasic: true,
    petCommandReadyAt: 0,
    petCommandRecharges: {}
  };
}

// Publish pet identity and visible state; pet scheduling remains private to the live execution owner.
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

  'quickDraw',

  'sharpeningStoneGrants',

  'petSwapCount'
]);

// Core fields have no inactive fallbacks; their values come from the live state.
export const RANGER_CORE_PUBLIC_STATE_PROJECTION = Object.freeze({
  keys: RANGER_CORE_PUBLIC_END_STATE_KEYS,
  defaults: {}
});
