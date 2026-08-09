import { flattenProfessionState } from "../../../platform/engine/profession.js";
import { RANGER_PETS } from "../data/ranger-pet-data.js";
import type {
  RangerConfig,
  RangerCoreState,
  RangerEndStateProjectionOptions,
  RangerState,
} from "../types.js";

export function selectedRangerPet(config: RangerConfig = {}) {
  const selected = String(config.selectedPet || "Pig");
  return RANGER_PETS.find((pet) => pet.name === selected) || RANGER_PETS[0];
}

export function createRangerCoreState(
  config: RangerConfig = {},
): RangerCoreState {
  const pet = selectedRangerPet(config);
  return {
    activePet: pet?.name || "",
    activePetSkillIds: [...(pet?.skillIds || [])],
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
    huntersGazeReadyAt: 0,
    playerOpeningStrikeReady: true,
    petOpeningStrikeReady: true,
    poisonMasterPetAttackReady: false,
    petSwapCount: 0,
  };
}

export function snapshotRangerState(state: unknown): RangerState {
  return structuredClone(
    flattenProfessionState(state),
  ) as unknown as RangerState;
}

export const RANGER_PUBLIC_END_STATE_KEYS: readonly (keyof RangerState)[] =
  Object.freeze([
    "activePet",
    "activePetSkillIds",
    "endurance",
    "maximumEndurance",
    "availableFlips",
    "autoattackChains",
    "winterBiteReady",
    "tailWindReadyAt",
    "furiousGripReadyAt",
    "sharpenedEdgesProgress",
    "quickDrawReadyAt",
    "quickDrawUntil",
    "trapCrippleActivations",
    "bloodThirstCharges",
    "rejuvenationReadyAt",
    "childOfEarthReadyAt",
    "clarionBondReadyAt",
    "petSwapCount",
    "astralForce",
    "maximumAstralForce",
    "celestialAvatarActive",
    "celestialAvatarEndsAt",
    "beastmodeActive",
    "archetype",
    "oneWolfPackUntil",
    "oneWolfPackReadyAt",
    "rangerUnleashed",
    "ambushReadyUntil",
    "cycloneBowActive",
    "arrows",
    "maximumArrows",
    "arrowsUpdatedAt",
    "windForce",
  ]);

const RANGER_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<RangerState>> =
  Object.freeze({
    astralForce: 0,
    maximumAstralForce: 100,
    celestialAvatarActive: false,
    celestialAvatarEndsAt: 0,
    beastmodeActive: false,
    archetype: "",
    oneWolfPackUntil: 0,
    oneWolfPackReadyAt: 0,
    rangerUnleashed: false,
    ambushReadyUntil: 0,
    cycloneBowActive: false,
    arrows: 0,
    maximumArrows: 8,
    arrowsUpdatedAt: 0,
    windForce: 0,
  });

export function projectRangerEndState({
  schedulerState,
}: RangerEndStateProjectionOptions): Record<string, unknown> {
  const state = snapshotRangerState(schedulerState.profession);
  return Object.fromEntries(
    RANGER_PUBLIC_END_STATE_KEYS.map((key) => [
      key,
      structuredClone(state[key] ?? RANGER_PUBLIC_INACTIVE_STATE_DEFAULTS[key]),
    ]),
  );
}
