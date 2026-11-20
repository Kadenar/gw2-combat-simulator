/** Keep Engineer public projections and derived-condition options closed to unknown fields. */
import type { buildEngineerCondition } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import type { engineerCoreModule } from '#gw2/professions/engineer/core/module.js';
import type { EngineerCanonicalBuild } from '#gw2/professions/engineer/types.js';

type Assert<T extends true> = T;
type PlanningState = ReturnType<NonNullable<typeof engineerCoreModule.state.project>>;
type ConditionOptions = Parameters<typeof buildEngineerCondition>[1];

export type EngineerRecordAssertions = [
  Assert<string extends keyof PlanningState ? false : true>,
  Assert<string extends keyof ConditionOptions ? false : true>,
  Assert<EngineerCanonicalBuild['assumptions']['alacrity'] extends boolean | undefined ? true : false>
];

declare const state: PlanningState;
// @ts-expect-error Public state rejects misspelled fields.
state.activeKti;
// @ts-expect-error Internal proc bookkeeping is not a public projection field.
state.traitProcReadyAt;
// @ts-expect-error Derived condition flags must preserve their boolean contract.
const invalidFixedDuration: ConditionOptions['fixedDuration'] = 'yes';
void invalidFixedDuration;
// @ts-expect-error Summon conditions take companion ownership from their specialization, not this builder.
const summonActor: ConditionOptions['actorType'] = 'summon';
void summonActor;
