import type { rangerPetCombatMetadata } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import type { rangerUiState } from '#gw2/professions/ranger/core/presentation.js';
import type { projectRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import type { RangerPlanningState } from '#gw2/professions/ranger/types.js';

/** Ranger presentation, and pet metadata expose only their declared fields. */

type Assert<T extends true> = T;
// Runtime bookkeeping must not appear in UI types, including the inferred Core projection.
type PrivateCoreKeys = 'player' | 'pendingFrostTrapEvents' | 'nextPetInstance';

export type RangerRecordAssertions = [
  Assert<Extract<PrivateCoreKeys, keyof RangerPlanningState> extends never ? true : false>,
  Assert<Extract<PrivateCoreKeys, keyof ReturnType<typeof projectRangerCoreState>> extends never ? true : false>,
  Assert<string extends keyof ReturnType<typeof rangerUiState> ? false : true>,
  Assert<string extends keyof ReturnType<typeof rangerPetCombatMetadata> ? false : true>
];
