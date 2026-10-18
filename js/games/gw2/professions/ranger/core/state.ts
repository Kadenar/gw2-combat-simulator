import {
  createPublicStateProjector,
  readProfessionCoreState,
  readProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import {
  createRangerActorProcState,
  type RangerActorProcState
} from '#gw2/professions/ranger/core/mechanics/actor-state.js';
import {
  createRangerPetState,
  rangerPetInstanceId,
  type RangerPetState
} from '#gw2/professions/ranger/core/mechanics/pet-state.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import { selectedRangerPet } from '#gw2/professions/ranger/data/pets.js';
import type { RangerConfig } from '#gw2/professions/ranger/types.js';

export interface RangerCoreState {
  activePet: string;
  activePetSlot: 1 | 2;
  petNames: [string, string];
  activePetSkillIds: SkillId[];
  /** The player's own readiness, mirrored by each pet lifetime's fields of the same shape. */
  player: RangerActorProcState;
  pet: RangerPetState | null;
  nextPetInstance: number;
  endurance: ResourceClock;
  availableFlips: SkillFlipWindows;
  stealthUntil: number;
  revealedUntil: number;
  autoattackChains: Record<string, SkillId>;
  winterBiteReady: boolean;

  quickDraw: ChargeGrant;
  pendingFrostTrapEvents: SimulationEventBase[];
  bloodThirst: ChargeGrant;
  sharpeningStoneGrants: ChargeGrant[];
}

/** Soulbeast's Beastmode replaces the pet with the merged player; every other state keeps a separate pet. */
export function rangerMerged(profession: unknown): boolean {
  return Boolean(
    readProfessionSpecializationState<{ beastmodeActive?: boolean }>(profession, 'Soulbeast')?.beastmodeActive
  );
}

// Initialize player resources and a separately owned first pet lifetime from the build selections.
export function createRangerCoreState(config: RangerConfig = {}): RangerCoreState {
  const pet = selectedRangerPet(config);
  const pet2 = selectedRangerPet(config, 2);
  return {
    activePet: pet.name,
    activePetSlot: 1,
    petNames: [pet.name, pet2.name],
    activePetSkillIds: [...pet.skillIds],
    player: createRangerActorProcState(),
    pet: createRangerPetState(rangerPetInstanceId(1, 0)),
    nextPetInstance: 1,
    endurance: createResourceClock(100),
    availableFlips: {},
    stealthUntil: 0,
    revealedUntil: 0,
    autoattackChains: {},
    winterBiteReady: false,

    quickDraw: grantCharges(0, 0),
    pendingFrostTrapEvents: [],
    bloodThirst: grantCharges(0, 0),
    sharpeningStoneGrants: []
  };
}

// Publish pet identity and visible state; pet scheduling remains private to the live execution owner.
const RANGER_PLAYER_PUBLIC_STATE_KEYS = Object.freeze([
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
] as const satisfies readonly (keyof RangerCoreState)[]);

/** Public consumers see only projected fields; adding runtime state never expands the presentation contract. */
export type RangerCorePublicState = Pick<RangerCoreState, (typeof RANGER_PLAYER_PUBLIC_STATE_KEYS)[number]> & {
  pet: Pick<RangerPetState, 'id' | 'ferociousSymbiosis' | 'wutheringWindReady'> | null;
};

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
