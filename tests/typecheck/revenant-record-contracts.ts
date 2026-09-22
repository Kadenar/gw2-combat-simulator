/** Keep Revenant pulse payloads explicitly typed. */
import type { ScheduledTask } from '#gw2/platform/execution/types.js';
import type { blossomingAura } from '#gw2/professions/revenant/core/execution/scepter.js';
type Assert<T extends true> = T;
type Pulse = NonNullable<Parameters<(typeof blossomingAura.taskHandlers)[string]>[1]['payload']>;
export type RevenantRecordAssertions = [Assert<string extends keyof Pulse ? false : true>];
declare const task: ScheduledTask<object>;
// @ts-expect-error Tasks without a declared payload do not expose arbitrary fields.
task.payload?.eventOrder;
