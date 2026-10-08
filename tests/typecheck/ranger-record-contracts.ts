import type { rangerPetCombatMetadata } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import type { rangerUiState } from '#gw2/professions/ranger/core/presentation.js';

/** Ranger presentation, and pet metadata expose only their declared fields. */

type Assert<T extends true> = T;
export type RangerRecordAssertions = [
  Assert<string extends keyof ReturnType<typeof rangerUiState> ? false : true>,
  Assert<string extends keyof ReturnType<typeof rangerPetCombatMetadata> ? false : true>
];
