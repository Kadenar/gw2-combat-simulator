import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { revenantCastCompleted } from '#gw2/professions/revenant/core/mechanics/trigger-points.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { claimActivation } from '#kernel/execution/activation-claims.js';

/** Pre-transition elite actions and the common observer share one completion claim per accepted activation. */
export function completeRevenantCast(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  if (!claimActivation(runtime.profession.core.activationClaims, 'revenant.cast-traits', cast.id)) return;

  runtime.fireTrigger(revenantCastCompleted, { cast });
}
