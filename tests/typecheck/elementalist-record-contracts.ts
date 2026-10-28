/** Keep public Elementalist state and native Weaver casts closed to unknown field names. */
import type { ElementalistCanonicalBuild } from '#gw2/professions/elementalist/build/types.js';
import type { elementalistCoreModule } from '#gw2/professions/elementalist/core/module.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import type { schedulePrimordialStance } from '#gw2/professions/elementalist/specializations/weaver/mechanics/primordial-stance.js';
import type { weaverModule } from '#gw2/professions/elementalist/specializations/weaver/module.js';
import { ELEMENTALIST_STATE_IDS as STATE } from '#gw2/professions/elementalist/state-ids.js';
import type { ElementalistUiContext } from '#gw2/professions/elementalist/types.js';

type Assert<T extends true> = T;
type PlanningState = ReturnType<NonNullable<typeof elementalistCoreModule.state.project>>;
type StanceCast = Parameters<typeof schedulePrimordialStance>[1];
type WeaverPlanningState = ReturnType<NonNullable<typeof weaverModule.state.project>>;

export type ElementalistRecordAssertions = [
  Assert<string extends keyof PlanningState ? false : true>,
  Assert<string extends keyof StanceCast ? false : true>,
  Assert<string extends keyof WeaverPlanningState ? false : true>,
  Assert<WeaverPlanningState[typeof STATE.SECONDARY_ATTUNEMENT] extends ElementalistAttunement | null ? true : false>,
  Assert<WeaverPlanningState[typeof STATE.WEAVE_SELF_UNTIL] extends number ? true : false>,
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

// Planning IDs preserve their value types through module registration and presentation.
declare const weaver: WeaverPlanningState;
declare const ui: ElementalistUiContext;
weaver[STATE.WEAVE_SELF_VISITED].map((element) => element.toLowerCase());
ui.professionState?.[STATE.PERFECT_WEAVE_UNTIL]?.toFixed(1);
// @ts-expect-error Runtime property names are not public planning IDs.
weaver.weaveSelfUntil;
// @ts-expect-error Presentation cannot accidentally read the obsolete public field.
ui.professionState?.secondaryAttunement;
// @ts-expect-error Unknown IDs cannot silently read an undefined observation.
weaver['gw2.weaver.missing'];
// @ts-expect-error Expiry observations are numeric rather than display strings.
weaver[STATE.WEAVE_SELF_UNTIL] = '20';
