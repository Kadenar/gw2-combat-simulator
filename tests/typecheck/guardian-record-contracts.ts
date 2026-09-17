/** Guardian emitters and scheduled flames expose only their declared fields. */
import type { GuardianEventExtra, GuardianStrikeFields } from '#gw2/professions/guardian/types.js';
type Assert<T extends true> = T;
export type GuardianRecordAssertions = [
  Assert<string extends keyof GuardianEventExtra ? false : true>,
  Assert<string extends keyof GuardianStrikeFields ? false : true>
];
