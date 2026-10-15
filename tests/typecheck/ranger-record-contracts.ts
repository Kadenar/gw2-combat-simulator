import type { rangerPetCombatMetadata } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import type { rangerUiState } from '#gw2/professions/ranger/core/presentation.js';
import type { RangerCorePublicState, projectRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import type { RangerState } from '#gw2/professions/ranger/types.js';

/** Ranger presentation, and pet metadata expose only their declared fields. */

type Assert<T extends true> = T;
// Runtime bookkeeping must not appear in UI types, and core projection keys must match their declared contract.
type PrivateCoreKeys = 'player' | 'pendingFrostTrapEvents' | 'nextPetInstance';
export type RangerRecordAssertions = [
  Assert<Extract<PrivateCoreKeys, keyof RangerState> extends never ? true : false>,
  Assert<
    Exclude<keyof RangerCorePublicState, keyof ReturnType<typeof projectRangerCoreState>> extends never ? true : false
  >,
  Assert<
    Exclude<keyof ReturnType<typeof projectRangerCoreState>, keyof RangerCorePublicState> extends never ? true : false
  >,
  Assert<string extends keyof ReturnType<typeof rangerUiState> ? false : true>,
  Assert<string extends keyof ReturnType<typeof rangerPetCombatMetadata> ? false : true>
];
