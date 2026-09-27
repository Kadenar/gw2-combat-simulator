/** Ranger presentation, and pet metadata expose only their declared fields. */
import type { rangerUiState } from '#gw2/professions/ranger/core/presentation.js';
import type { rangerPetCombatMetadata } from '#gw2/professions/ranger/core/mechanics/pets.js';
type Assert<T extends true> = T;
export type RangerRecordAssertions = [
  Assert<string extends keyof ReturnType<typeof rangerUiState> ? false : true>,
  Assert<string extends keyof ReturnType<typeof rangerPetCombatMetadata> ? false : true>
];
