/** Keep Mesmer event extras, proc candidates, and UI projections closed to misspelled fields. */
import type { MesmerEventExtra } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerExpectedProcCandidate } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerUiState } from '#gw2/professions/mesmer/types.js';
type Assert<T extends true> = T;
export type MesmerRecordAssertions = [
  Assert<string extends keyof MesmerEventExtra ? false : true>,
  Assert<string extends keyof MesmerExpectedProcCandidate ? false : true>,
  Assert<string extends keyof MesmerUiState ? false : true>
];
declare const event: MesmerEventExtra;
// @ts-expect-error Controller fields reject misspelled clone identity.
event.cloneID;
