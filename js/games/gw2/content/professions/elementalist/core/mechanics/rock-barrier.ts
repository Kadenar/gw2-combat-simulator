/** Owns the Rock Barrier/Hurl flip window and its delayed root-skill recharge. */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/elementalist/core/profiles.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import type { ElementalistSchedulerContext } from '#gw2/content/professions/elementalist/types.js';

/** Mechanic-trigger handlers open and consume the cross-cast barrier release window. */
export const elementalistRockBarrierMechanicHandlers = Object.freeze({
  'elementalist.core.open-rock-barrier': ({
    context,
    at
  }: {
    context: ElementalistSchedulerContext;
    at: number;
  }): void => {
    professionCoreState(context).rockBarrierExpiresAt =
      at + balanceProfileValueFromContext(context, PROFILE.rockBarrier, 'durationMultiplier', 30);
  },
  'elementalist.core.release-rock-barrier': ({
    context,
    at
  }: {
    context: ElementalistSchedulerContext;
    at: number;
  }): void => {
    professionCoreState(context).rockBarrierExpiresAt = 0;
    const root = context.catalog.skillsById.get(ID.ROCK_BARRIER);
    if (root) {
      context.state.cooldowns.set(root.id, at + context.rechargeDurationFor(root, at, { rockBarrierRelease: true }));
    }
  }
});
