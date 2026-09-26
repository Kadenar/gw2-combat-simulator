/** Guardian live state and strike emitters expose only their declared fields. */
import type { GuardianRuntimeState, GuardianStrikeFields } from '#gw2/professions/guardian/types.js';
type Assert<T extends true> = T;
export type GuardianRecordAssertions = [
  Assert<string extends keyof GuardianRuntimeState ? false : true>,
  Assert<string extends keyof GuardianStrikeFields ? false : true>
];
