import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { consumeScoundrelsLuck } from '#gw2/professions/thief/specializations/antiquary/traits/behavior.js';
import type { ThiefDoubleEdgeOutcome, ThiefSkill } from '#gw2/professions/thief/types.js';
import { EPSILON } from '#kernel/core/clock.js';

/** Accepted Canach coin initiative, held by cast identity until commitment or cancellation. */
export const coinInitiative = new WeakMap<RuntimeCast<ThiefSkill>, number>();

/** Double Edge is risky only while its recharge is running; Scoundrel's Luck turns one risky use into a success. */
function acceptDoubleEdge(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): ThiefDoubleEdgeOutcome {
  if ((runtime.cooldownController.readyAt(cast.skill.id) || 0) <= runtime.time + EPSILON) return 'success';
  if (consumeScoundrelsLuck(runtime)) return 'success';

  return cast.command.doubleEdgeOutcome === 'backfire' ? 'backfire' : 'success';
}

/** Canach coins alternate heads and tails across uses; a backfire pays only for heads. */
export function tossCanachCoins(runtime: ThiefRuntime, backfire: boolean): number {
  const state = antiquaryState.from(runtime);
  let initiative = 0;
  for (let coin = 0; coin < 3; coin += 1) {
    const heads = (state.canachCoinIndex || 0) % 2 === 0;
    state.canachCoinIndex = (state.canachCoinIndex || 0) + 1;
    initiative += backfire ? Number(heads) : heads ? 2 : 1;
  }

  return initiative;
}

/**
 * The accepted Double Edge outcome is fixed at cast start, including uses the rotation cancels immediately, and its
 * packets are timed from the reserved end of the cast.
 */
export function startDoubleEdge(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const state = antiquaryState.from(runtime);
  const skill = cast.skill;
  const outcome = acceptDoubleEdge(runtime, cast);
  if (outcome === 'backfire')
    // The backfire variant stays visible until the running recharge ends.
    state.backfireState[skill.id] = true;
  else delete state.backfireState[skill.id];
}
