import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { revenantCastCompleted } from '#gw2/professions/revenant/core/mechanics/trigger-points.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { claimActivation } from '#kernel/execution/activation-claims.js';

type RevenantHooks = RuntimeHooks<RevenantRuntimeState, RevenantSkill>;

/** Core traits read the old ammo or form, and elite transitions see the rewards those traits grant. */
export function orderEliteCastRewards(hooks: RevenantHooks, beforeRewards: readonly string[] = []): RevenantHooks {
  const handlers: Record<string, NonNullable<RevenantHooks['sideEffectHandlers']>[string]> = {};
  const eliteActions = hooks.sideEffectHandlers ?? {};
  for (const id of beforeRewards) {
    if (!Object.hasOwn(eliteActions, id))
      throw new TypeError(`Unknown elite action ordered before Core rewards: ${id}`);
  }

  for (const [id, handle] of Object.entries(eliteActions)) {
    handlers[id] = (runtime, context, action) => {
      if (context.kind === 'cast' && context.on === 'castCommit' && !beforeRewards.includes(id))
        completeRevenantCast(runtime, context.cast);

      handle(runtime, context, action);
    };
  }

  return { ...hooks, sideEffectHandlers: handlers };
}

/** Elite commit actions and the final Core hook share one reward per activation. */
export function completeRevenantCast(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  if (!claimActivation(runtime.profession.core.activationClaims, 'revenant.cast-traits', cast.id)) return;

  runtime.fireTrigger(revenantCastCompleted, { cast });
}
