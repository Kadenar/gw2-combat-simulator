import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { createStealthState, type StealthState } from '#gw2/platform/combat/stealth.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import { type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import {
  cloneStateFields,
  readProfessionCoreState,
  readProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
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
import { selectedRangerPet } from '#gw2/professions/ranger/data/pets.js';
import type { RangerConfig } from '#gw2/professions/ranger/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface RangerCoreState extends StealthState {
  /** The selected pair and active slot own identity; catalog facts are queried rather than synchronized. */
  activePetSlot: 1 | 2;
  readonly petNames: readonly [string, string];
  /** The player's own readiness, mirrored by each pet lifetime's fields of the same shape. */
  player: RangerActorProcState;
  pet: RangerPetState | null;
  nextPetInstance: number;
  endurance: ResourceClock;
  availableFlips: SkillFlipWindows;
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
    activePetSlot: 1,
    petNames: [pet.name, pet2.name],
    player: createRangerActorProcState(),
    pet: createRangerPetState(rangerPetInstanceId(1, 0)),
    nextPetInstance: 1,
    endurance: createResourceClock(ENDURANCE.maximum),
    availableFlips: {},
    ...createStealthState(),
    autoattackChains: {},
    winterBiteReady: false,

    quickDraw: grantCharges(0, 0),
    pendingFrostTrapEvents: [],
    bloodThirst: grantCharges(0, 0),
    sharpeningStoneGrants: []
  };
}

/** Detach consumed public observations while leaving private proc grants with the runtime owner. */
export function projectRangerCoreState(input: Gw2PlanningStateInput) {
  const { pet } = readProfessionCoreState<RangerCoreState>(input.profession);
  const state = cloneStateFields((input.profession as { core: RangerCoreState }).core, [
    'autoattackChains',
    'endurance',
    'availableFlips',
    'activePetSlot',
    'petNames',
    'winterBiteReady',
    'quickDraw',
    'stealthStartedAt',
    'stealthUntil',
    'revealedUntil'
  ]);
  return {
    [STATE.AUTOATTACK_CHAINS]: state.autoattackChains,
    [STATE.ENDURANCE]: state.endurance,
    [STATE.AVAILABLE_FLIPS]: state.availableFlips,
    [STATE.ACTIVE_PET_SLOT]: state.activePetSlot,
    [STATE.PET_NAMES]: state.petNames,
    [STATE.WINTER_BITE_READY]: state.winterBiteReady,
    [STATE.QUICK_DRAW]: state.quickDraw,
    [STATE.STEALTH_STARTED_AT]: state.stealthStartedAt,
    [STATE.STEALTH_UNTIL]: state.stealthUntil,
    [STATE.REVEALED_UNTIL]: state.revealedUntil,
    [STATE.PET]: pet
      ? { id: pet.id, ferociousSymbiosis: { ...pet.ferociousSymbiosis }, wutheringWindReady: pet.wutheringWindReady }
      : null
  };
}
