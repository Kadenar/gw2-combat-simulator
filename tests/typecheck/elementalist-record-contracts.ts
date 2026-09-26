/** Keep public Elementalist state and native Weaver casts closed to unknown field names. */
import type { projectElementalistPlanningState } from '#gw2/professions/elementalist/family-state.js';
import type { schedulePrimordialStance } from '#gw2/professions/elementalist/specializations/weaver/mechanics/primordial-stance.js';
import type { ElementalistCanonicalBuild } from '#gw2/professions/elementalist/build/types.js';

type Assert<T extends true> = T;
type PlanningState = ReturnType<typeof projectElementalistPlanningState>;
type StanceCast = Parameters<typeof schedulePrimordialStance>[1];

export type ElementalistRecordAssertions = [
  Assert<string extends keyof PlanningState ? false : true>,
  Assert<string extends keyof StanceCast ? false : true>,
  Assert<ElementalistCanonicalBuild['assumptions']['alacrity'] extends boolean | undefined ? true : false>
];

declare const state: PlanningState;
declare const cast: StanceCast;
// @ts-expect-error Public projections reject misspelled state fields.
state.primaryAttunment;
// @ts-expect-error Internal proc bookkeeping is not a public projection field.
state.procReadyAt;
// @ts-expect-error Native casts reject misspelled activation IDs.
cast.activationID;
