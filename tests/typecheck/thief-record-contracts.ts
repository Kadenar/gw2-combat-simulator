/** Thief live state and specialization queries expose only their declared fields. */
import type { InternalWork } from '#gw2/platform/simulation/internal-work.js';
import type { ThiefRuntimeState } from '#gw2/professions/thief/types.js';
import type { thiefRuntimeSpecializationState } from '#gw2/professions/thief/core/traits/modifiers.js';
type Assert<T extends true> = T;
export type ThiefRecordAssertions = [
  Assert<string extends keyof ThiefRuntimeState ? false : true>,
  Assert<string extends keyof ReturnType<typeof thiefRuntimeSpecializationState> ? false : true>
];
declare const task: InternalWork<'fixture.task', object>;
// @ts-expect-error Tasks without a declared payload do not expose arbitrary fields.
task.payload?.eventOrder;
