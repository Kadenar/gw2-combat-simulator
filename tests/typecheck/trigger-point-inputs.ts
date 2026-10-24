import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';

// Only empty points may omit their input; payload inference comes from the declared point.
export function triggerPointInputs(runtime: MechanicContext): void {
  const empty = defineTriggerPoint<Record<string, never>>('fixture.empty', [1]);
  const populated = defineTriggerPoint<{ count: number }>('fixture.populated', [1]);

  runtime.fireTrigger(empty);
  runtime.fireTrigger(empty, {});
  runtime.fireTrigger(populated, { count: 1 });
  // @ts-expect-error A populated point requires its payload.
  runtime.fireTrigger(populated);
  // @ts-expect-error Required payload fields cannot be omitted.
  runtime.fireTrigger(populated, {});
  // @ts-expect-error The payload must match the point's declared input.
  runtime.fireTrigger(populated, { count: '1' });
  // @ts-expect-error An empty point cannot accept additional fields.
  runtime.fireTrigger(empty, { count: 1 });
}
