/** Keep public Elementalist state and scheduled Weaver payloads closed to unknown field names. */
import type { projectElementalistEndState } from '#gw2/professions/elementalist/family-state.js';
import type { handleWeaveSelfActivation } from '#gw2/professions/elementalist/specializations/weaver/mechanics/weave-self.js';
import type { handlePrimordialStanceTick } from '#gw2/professions/elementalist/specializations/weaver/mechanics/primordial-stance.js';
import type { ElementalistCanonicalBuild } from '#gw2/professions/elementalist/build/types.js';

type Assert<T extends true> = T;
type EndState = ReturnType<typeof projectElementalistEndState>;
type WeavePayload = NonNullable<Parameters<typeof handleWeaveSelfActivation>[1]['payload']>;
type StancePayload = NonNullable<Parameters<typeof handlePrimordialStanceTick>[1]['payload']>;

export type ElementalistRecordAssertions = [
  Assert<string extends keyof EndState ? false : true>,
  Assert<string extends keyof WeavePayload ? false : true>,
  Assert<string extends keyof StancePayload ? false : true>,
  Assert<ElementalistCanonicalBuild['assumptions']['alacrity'] extends boolean | undefined ? true : false>
];

declare const state: EndState;
declare const payload: WeavePayload;
// @ts-expect-error Public projections reject misspelled state fields.
state.primaryAttunment;
// @ts-expect-error Internal proc bookkeeping is not a public projection field.
state.procReadyAt;
// @ts-expect-error Scheduled payloads reject misspelled source IDs.
payload.sourceID;
