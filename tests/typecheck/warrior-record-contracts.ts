/** Warrior stat copies, flip expiry values, and release rows retain their actual contracts. */
import type { WarriorCoreState } from '#gw2/professions/warrior/core/state.js';
import type { WarriorModifierAttributes } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import type { dragonChargeReleaseProjection } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/charge-release.js';
type Assert<T extends true> = T;
export type WarriorRecordAssertions = [
  Assert<string extends keyof WarriorModifierAttributes ? false : true>,
  Assert<string extends keyof ReturnType<typeof dragonChargeReleaseProjection> ? false : true>,
  Assert<WarriorCoreState['availableFlips'][string] extends number ? true : false>
];
