import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistRechargeWork } from '#gw2/professions/elementalist/core/mechanics/recharge.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Releasing or expiring the stored barrier starts the root skill's held recharge once. */
export function releaseRockBarrier(runtime: ElementalistRuntime): void {
  if (!consumeSkillFlip(runtime.profession.core.availableFlips, ID.HURL)) return;
  runtime.cancelOwner({ id: 'elementalist.rock-barrier', generation: 0 });
  const root = runtime.helpers.skillsById.get(ID.ROCK_BARRIER);
  if (root) {
    runtime.cooldownController.startRecharge(
      root,
      runtime.time,
      elementalistRechargeWork(runtime, root, Number(root.cooldown ?? 0), true)
    );
    resetAutoattackChains(runtime, [root.id]);
  }
}

/** The flip and its expiry share a deadline; replacing a barrier retires its previous timer. */
export const elementalistRockBarrierTasks = {
  'elementalist.core.open-rock-barrier'(runtime: ElementalistRuntime): void {
    const expiresAt =
      runtime.time +
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.rockBarrier), 'durationMultiplier');
    armSkillFlip(runtime.profession.core.availableFlips, ID.HURL, runtime.time, expiresAt);
    runtime.cancelOwner({ id: 'elementalist.rock-barrier', generation: 0 });
    runtime.schedule('elementalist.core.release-rock-barrier', expiresAt, null, {
      id: 'elementalist.rock-barrier',
      generation: 0
    });
  },
  'elementalist.core.release-rock-barrier': releaseRockBarrier
};
