import type { InputAction } from '#gw2/platform/execution/input-controls.js';

/** A detached reporting window over accepted execution inputs. */
export interface InputTrace {
  readonly version: 1;
  readonly start: number;
  readonly end: number;
  readonly actions: readonly InputAction[];
}

/** Detach accepted inputs and clip to APM's combat/rotation boundaries, excluding observation tails. */
export function projectInputTrace(actions: readonly InputAction[], start: number, end: number): InputTrace {
  const seen = new Set<string>();
  return {
    version: 1,
    start,
    end,
    actions: actions
      .filter((action) => {
        if (action.at < start || action.at > end || seen.has(action.activationId)) return false;

        seen.add(action.activationId);
        return true;
      })
      .map((action) => ({ ...action }))
  };
}
