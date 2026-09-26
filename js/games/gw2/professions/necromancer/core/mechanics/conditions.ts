import { isTimeInWindow } from '#kernel/core/clock.js';

/** Cleanses distinct self-condition types from the currently active applications. */

import type { NecromancerCoreState, NecromancerSelfCondition } from '#gw2/professions/necromancer/core/state.js';

/** Removes expired or not-yet-active self-condition applications and returns the remaining active set. */
function purgeNecromancerSelfConditions(state: NecromancerCoreState, at: number): NecromancerSelfCondition[] {
  state.selfConditions = (state.selfConditions || []).filter((application) =>
    isTimeInWindow(at, application.appliedAt, application.expiresAt)
  );
  return state.selfConditions;
}

/** Removes up to the requested number of distinct active self-condition types. */
export function removeNecromancerSelfCondition(
  state: NecromancerCoreState,
  at: number,
  maximumConditionTypes = 1
): void {
  const active = purgeNecromancerSelfConditions(state, at);
  const selected = new Set<string>();
  for (const application of active) {
    if (selected.size >= maximumConditionTypes) break;
    selected.add(application.condition);
  }

  state.selfConditions = active.filter((application) => !selected.has(application.condition));
}
