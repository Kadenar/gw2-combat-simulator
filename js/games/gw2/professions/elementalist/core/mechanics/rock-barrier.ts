import { resetAutoattackChains } from '#gw2/platform/execution/autoattack-chains.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { compileRechargeRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import { skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { elementalistRechargeWork } from '#gw2/professions/elementalist/core/mechanics/recharge.js';
import { geomancersTrainingRechargeRule } from '#gw2/professions/elementalist/core/traits/earth/index.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

// Held recharge bypasses cast admission, so reuse the Earth trait's declaration without spending next-cast grants.
const rockBarrierTrainingRecharge = compileRechargeRules<ElementalistRuntimeState, ElementalistSkill>([
  { ...geomancersTrainingRechargeRule, trait: TRAIT.GEOMANCERS_TRAINING }
]);

/** Releasing or expiring the stored barrier starts the root skill's held recharge once. */
function releaseRockBarrier(runtime: ElementalistRuntime): void {
  if (!consumeSkillFlip(runtime.profession.core.availableFlips, ID.HURL)) return;

  runtime.cancelOwner({ id: 'elementalist.rock-barrier', generation: 0 });
  const root = runtime.helpers.skillsById.get(ID.ROCK_BARRIER);

  if (root) {
    runtime.cooldownController.startRecharge(
      root,
      runtime.time,
      rockBarrierTrainingRecharge(runtime, root, elementalistRechargeWork(runtime, root, root.cooldown ?? 0, true))
    );
    resetAutoattackChains(runtime, [root.id]);
  }
}

/** The flip and its expiry share a deadline; replacing a barrier retires its previous timer. */
const elementalistRockBarrierTasks = {
  'elementalist.core.open-rock-barrier'(runtime: ElementalistRuntime): void {
    const expiresAt = runtime.time + skillNumberFromContext(runtime, ID.ROCK_BARRIER, 'flipDuration');
    armSkillFlip(runtime.profession.core.availableFlips, ID.HURL, runtime.time, expiresAt);
    runtime.cancelOwner({ id: 'elementalist.rock-barrier', generation: 0 });
    runtime.schedule('elementalist.core.release-rock-barrier', expiresAt, null, {
      id: 'elementalist.rock-barrier',
      generation: 0
    });
  },
  'elementalist.core.release-rock-barrier': releaseRockBarrier
};

/** Registers Rock Barrier opening and release with the Core hook assembly. */
export const elementalistRockBarrierLifecycle = {
  tasks: elementalistRockBarrierTasks
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;
