/** Skill flip expiry records retain their execution contract. */
import { type SkillFlipCommands, type SkillFlipWindow } from '#gw2/platform/execution/skill-flips.js';

type Assert<T extends true> = T;

export type SkillFlipRecordAssertions = [
  Assert<SkillFlipCommands['flips'][string] extends SkillFlipWindow ? true : false>
];
