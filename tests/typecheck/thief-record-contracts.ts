/** Thief tasks and specialization queries require declared fields instead of open records. */
import type { ThiefScheduledTask } from '#gw2/professions/thief/types.js';
import type { thiefRuntimeSpecializationState } from '#gw2/professions/thief/core/traits/modifiers.js';
import type { thiefAxeReaction } from '#gw2/professions/thief/core/mechanics/weapon-state.js';
type Assert<T extends true> = T;
export type ThiefRecordAssertions = [
  Assert<string extends keyof ThiefScheduledTask['payload'] ? false : true>,
  Assert<string extends keyof ReturnType<typeof thiefRuntimeSpecializationState> ? false : true>,
  Assert<
    string extends keyof Parameters<(typeof thiefAxeReaction.taskHandlers)['thief.spinning-axe']>[1]['payload']
      ? false
      : true
  >
];
declare const task: ThiefScheduledTask;
// @ts-expect-error An untyped task must not expose a field from a specific payload.
task.payload.eventOrder;
