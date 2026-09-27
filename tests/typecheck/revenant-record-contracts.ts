/** Revenant live state and cost inputs expose only their declared fields. */
import type { InternalWork } from '#gw2/platform/simulation/internal-work.js';
import type { RevenantEnergyCostInput, RevenantRuntimeState } from '#gw2/professions/revenant/types.js';
type Assert<T extends true> = T;
export type RevenantRecordAssertions = [
  Assert<string extends keyof RevenantRuntimeState ? false : true>,
  Assert<string extends keyof RevenantEnergyCostInput ? false : true>
];
declare const task: InternalWork<'fixture.task', object>;
// @ts-expect-error Tasks without a declared payload do not expose arbitrary fields.
task.payload?.eventOrder;
