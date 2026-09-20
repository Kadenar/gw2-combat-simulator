/** Keep Engineer public projections and derived-condition flags closed to unknown fields. */
import type { projectEngineerPlanningState } from '#gw2/professions/engineer/family-state.js';
import type { applyEngineerDerivedCondition } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import type { EngineerCanonicalBuild } from '#gw2/professions/engineer/types.js';

type Assert<T extends true> = T;
type PlanningState = ReturnType<typeof projectEngineerPlanningState>;
type ConditionFlags = NonNullable<Parameters<typeof applyEngineerDerivedCondition>[2]['metadata']>;

export type EngineerRecordAssertions = [
  Assert<string extends keyof PlanningState ? false : true>,
  Assert<string extends keyof ConditionFlags ? false : true>,
  Assert<EngineerCanonicalBuild['assumptions']['alacrity'] extends boolean | undefined ? true : false>
];

declare const state: PlanningState;
// @ts-expect-error Public state rejects misspelled fields.
state.activeKti;
// @ts-expect-error Internal proc bookkeeping is not a public projection field.
state.traitProcReadyAt;
// @ts-expect-error Derived condition flags must preserve their boolean contract.
const invalidFlags: ConditionFlags = { fixedDuration: 'yes' };
void invalidFlags;
