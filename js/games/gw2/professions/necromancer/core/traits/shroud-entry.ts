import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import {
  armPlagueSending,
  enterFuriousDemise,
  enterWeakeningShroud
} from '#gw2/professions/necromancer/core/traits/conditions.js';
import {
  prepareArmoredShroud,
  prepareShroudedRemoval,
  prepareSoulComprehension
} from '#gw2/professions/necromancer/core/traits/carapace.js';
import {
  applySoulBarbs,
  enterEternalLife,
  enterSpeedOfShadows
} from '#gw2/professions/necromancer/core/traits/shroud.js';
import { enterAwakenThePain, enterSpitefulSpirit } from '#gw2/professions/necromancer/core/traits/behavior.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';
import { isTimeInWindow } from '#kernel/core/clock.js';

/** Pre-entry grants observe the old Carapace before removals and the form transition. */
export function prepareShroudEntry(runtime: NecromancerRuntime): void {
  const state = runtime.profession.core;
  prepareSoulComprehension(runtime);

  prepareArmoredShroud(runtime);

  state.selfConditions = state.selfConditions.filter((application) =>
    isTimeInWindow(runtime.time, application.appliedAt, application.expiresAt)
  );
  prepareShroudedRemoval(runtime);

  armPlagueSending(runtime, state.selfConditions.length > 0);
}

/** Post-entry effects retain their cross-line order after specialization callbacks and resource refresh. */
export function shroudEntryEffects(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  applySoulBarbs(runtime);
  enterAwakenThePain(runtime, cast);
  enterFuriousDemise(runtime, cast);
  enterSpeedOfShadows(runtime, cast);
  enterEternalLife(runtime, cast);
  enterWeakeningShroud(runtime, cast);
  enterSpitefulSpirit(runtime, cast);
}
