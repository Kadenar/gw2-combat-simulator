/** Warrior flip expiry values and release rows retain their actual contracts. */
import { type SkillFlipCommands, type SkillFlipWindow } from '#gw2/platform/execution/skill-flips.js';
import type { dragonChargeReleaseProjection } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/charge-release.js';

type Assert<T extends true> = T;

export type WarriorRecordAssertions = [
  Assert<string extends keyof ReturnType<typeof dragonChargeReleaseProjection> ? false : true>,
  Assert<SkillFlipCommands['flips'][string] extends SkillFlipWindow ? true : false>
];
