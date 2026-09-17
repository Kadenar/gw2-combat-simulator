/** Ranger presentation, pet metadata, and stealth tasks expose only their declared fields. */
import type { rangerUiState } from '#gw2/professions/ranger/core/presentation.js';
import type { rangerPetCombatMetadata } from '#gw2/professions/ranger/core/mechanics/pets.js';
import type { rangerWeaponTaskHandlers } from '#gw2/professions/ranger/core/mechanics/weapon-state.js';
type Assert<T extends true> = T;
type Payload = NonNullable<Parameters<(typeof rangerWeaponTaskHandlers)['ranger.stealth-event']>[1]['payload']>;
export type RangerRecordAssertions = [
  Assert<string extends keyof ReturnType<typeof rangerUiState> ? false : true>,
  Assert<string extends keyof ReturnType<typeof rangerPetCombatMetadata> ? false : true>,
  Assert<string extends keyof Payload ? false : true>
];
