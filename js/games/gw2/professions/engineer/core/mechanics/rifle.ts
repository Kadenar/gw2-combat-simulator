/** Rifle triggers grant independent charges; the weapon flip follows the remaining live charges. */
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { sideEffectAmount } from '#gw2/platform/effects/action-dispatch.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerRuntime, EngineerRuntimeState, EngineerSkill } from '#gw2/professions/engineer/types.js';
import { consumeOldestStacks, expireStacks, purgeExpiredStacks } from '#kernel/resources/timed-stacks.js';

/** Expiry removes only elapsed charges and keeps the ambush exposed until the final charge closes. */
function syncRocketBurstCharges(runtime: EngineerRuntime): void {
  const state = runtime.profession.core;
  state.rocketBurstChargeExpiries = purgeExpiredStacks(state.rocketBurstChargeExpiries, runtime.time);
  const expiries = state.rocketBurstChargeExpiries;

  if (expiries.length) {
    runtime.armFlip(ID.ROCKET_BURST, { uses: expiries.length, expiresAt: Math.max(...expiries) });
  } else {
    runtime.clearFlip(ID.ROCKET_BURST);
  }
}

export const engineerRifleLifecycle = {
  sideEffectHandlers: {
    'engineer.rocket-burst-grant'(runtime, context, action) {
      if (context.kind !== 'cast' || action.amount == null)
        throw new TypeError('Rocket Burst grants require a cast and a charge duration.');

      const expiresAt = gw2Time(runtime.time + sideEffectAmount(runtime, action.amount));
      runtime.profession.core.rocketBurstChargeExpiries.push(expiresAt);
      syncRocketBurstCharges(runtime);
      runtime.scheduleExpiry('engineer.rocket-burst-expire', expiresAt);
    },
    'engineer.rocket-burst-consume'(runtime) {
      // Spend the oldest grant so the other charge deadlines remain unchanged, even after interruption.
      const state = runtime.profession.core;
      state.rocketBurstChargeExpiries = consumeOldestStacks(state.rocketBurstChargeExpiries, 1, runtime.time).expiries;
      syncRocketBurstCharges(runtime);
    }
  },
  tasks: {
    // A spent charge's queued expiry cannot remove a later grant; expiry also drops charges ending now.
    'engineer.rocket-burst-expire'(runtime) {
      const state = runtime.profession.core;
      state.rocketBurstChargeExpiries = expireStacks(state.rocketBurstChargeExpiries, runtime.time);
      syncRocketBurstCharges(runtime);
    }
  }
} satisfies RuntimeHooks<EngineerRuntimeState, EngineerSkill>;
